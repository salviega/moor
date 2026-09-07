/**
 * One cycle of the agent (04 §4.4, 05 §8), host-agnostic: it starts from the
 * chain — price, names, balances — derives with @moor/core, and writes
 * moor.agent.* on each position name through one multicall on the holder's
 * resolver. That is the whole of what it can do; the negative-role tests in
 * packages/contracts are what say so. It never builds, signs or sends anything
 * to Aqua, the registry or the holder's records, and there is no code path
 * here that could. `main.ts` loops it under Node; `edge.ts` runs it once per
 * request on Supabase.
 */
import {
	agentRecordValues,
	agentSetTextCall,
	buildReading,
	detectTriggers,
	deterministicProposal,
	ensV2Sepolia,
	type LabelRegisteredLog,
	type LogsClient,
	labelRegisteredEvent,
	listPositions,
	moorSepolia,
	type PositionView,
	type Proposal,
	permissionedRegistryAbi,
	proposalPrompt,
	readPositionView,
	readPrice,
	resolveDemoPair,
	shouldPropose,
	simulate,
} from "@moor/core";
import {
	type Address,
	createPublicClient,
	createWalletClient,
	type Hex,
	type HttpTransport,
	http,
	type PrivateKeyAccount,
	type PublicClient,
	type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import type { Env } from "./env";
import { proposeWithGroq } from "./model";

/** What a host must give the cycle to log with; pino under Node, JSON on stdout on Supabase. */
export interface Log {
	info(fields: Record<string, unknown>, msg: string): void;
	warn(fields: Record<string, unknown>, msg: string): void;
}

export interface Clients {
	account: PrivateKeyAccount;
	publicClient: PublicClient<HttpTransport, typeof sepolia>;
	walletClient: WalletClient<HttpTransport, typeof sepolia, PrivateKeyAccount>;
}

export function makeClients(env: Env): Clients {
	const account = privateKeyToAccount(env.AGENT_PRIVATE_KEY as Hex);
	const transport = http(env.SEPOLIA_RPC_URL);
	return {
		account,
		publicClient: createPublicClient({ chain: sepolia, transport }),
		walletClient: createWalletClient({ account, chain: sepolia, transport }),
	};
}

/** eth_getLogs in chunks: the holder's registry is young and small, the RPC's range limit is the constraint. */
function makeLogsClient(env: Env, publicClient: Clients["publicClient"]): LogsClient {
	return {
		async getLogs(args) {
			const latest = await publicClient.getBlockNumber();
			const out: LabelRegisteredLog[] = [];
			const chunk = BigInt(env.AGENT_LOGS_CHUNK);
			const start = args.fromBlock === "earliest" ? env.AGENT_FROM_BLOCK : args.fromBlock;
			for (let from = start; from <= latest; from += chunk) {
				const to = from + chunk - 1n < latest ? from + chunk - 1n : latest;
				const logs = await publicClient.getLogs({
					address: args.address,
					event: labelRegisteredEvent,
					fromBlock: from,
					toBlock: to,
				});
				for (const l of logs) out.push({ args: l.args, blockNumber: l.blockNumber });
			}
			return out;
		},
	};
}

async function propose(
	env: Env,
	log: Log,
	view: PositionView,
	price: number,
	now: number,
): Promise<{ proposal: Proposal; simulation: string; by: "groq" | "deterministic" }> {
	const pair = resolveDemoPair(view.tokenIn, view.tokenOut);
	const triggers = detectTriggers(view, price, now);
	const fallback = deterministicProposal(triggers[0] ?? "farFromRange", view, price, now);
	if (env.GROQ_API_KEY) {
		try {
			const answer = await proposeWithGroq(
				env.GROQ_API_KEY,
				env.AGENT_MODEL,
				proposalPrompt(view, price, now, triggers, pair),
			);
			if (answer) {
				const proposal = { ...answer, trigger: answer.trigger ?? triggers[0] };
				return { proposal, simulation: simulate(view, price, proposal, pair), by: "groq" };
			}
			log.warn(
				{ position: view.name },
				"model answer refused or invalid; using the deterministic proposal",
			);
		} catch (err) {
			// The message, not the stack: never a key, never a prompt in the logs (AGENTS.md, Security).
			const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
			log.warn(
				{ reason, position: view.name },
				"model call failed; using the deterministic proposal",
			);
		}
	}
	return {
		proposal: fallback,
		simulation: simulate(view, price, fallback, pair),
		by: "deterministic",
	};
}

/** One line per position, the same fields the log carries; JSON-safe so a host can return it. */
export interface CycleLine {
	position: string;
	state: PositionView["state"];
	price: number;
	converted: number;
	triggers: string[];
	proposal: string;
	by: string;
	hash?: Hex | undefined;
	dryRun: boolean;
}

export async function runCycle(
	env: Env,
	{ publicClient, walletClient }: Clients,
	log: Log,
): Promise<{ registry: Address; positions: CycleLine[] }> {
	const now = Math.floor(Date.now() / 1000);
	const parentLabel = env.AGENT_PARENT_NAME.replace(/\.eth$/, "");
	const [registry, resolver] = (await Promise.all([
		publicClient.readContract({
			address: ensV2Sepolia.ethRegistry,
			abi: permissionedRegistryAbi,
			functionName: "getSubregistry",
			args: [parentLabel],
		}),
		publicClient.readContract({
			address: ensV2Sepolia.ethRegistry,
			abi: permissionedRegistryAbi,
			functionName: "getResolver",
			args: [parentLabel],
		}),
	])) as [Address, Address];
	const [named, price] = await Promise.all([
		listPositions(makeLogsClient(env, publicClient), {
			registry,
			registrar: moorSepolia.moorRegistrar,
		}),
		readPrice(publicClient),
	]);
	const lines: CycleLine[] = [];
	for (const n of named) {
		const view = await readPositionView(publicClient, {
			parentName: env.AGENT_PARENT_NAME,
			label: n.label,
			price: price.price,
			now,
		});
		if (view.state === "closed") continue;
		const triggers = detectTriggers(view, price.price, now);
		let proposal = view.agent.proposal;
		let simulation = view.agent.simulation ?? "";
		let by = "kept";
		if ((env.AGENT_FORCE_PROPOSE && triggers.length > 0) || shouldPropose(triggers, view.agent)) {
			const p = await propose(env, log, view, price.price, now);
			proposal = p.proposal;
			simulation = p.simulation;
			by = p.by;
		} else if (triggers.length === 0 && proposal && proposal.kind !== "none") {
			// The reason went away (price came back, holder acted): clear the standing proposal.
			proposal = undefined;
			simulation = "";
			by = "cleared";
		}
		const values = agentRecordValues(buildReading(view, price.price, now), proposal, simulation);
		const call = agentSetTextCall(resolver, view.name, values);
		let hash: Hex | undefined;
		if (!env.AGENT_DRY_RUN) {
			hash = await walletClient.sendTransaction({ to: call.to, data: call.data });
			await publicClient.waitForTransactionReceipt({ hash });
		}
		const line: CycleLine = {
			position: view.name,
			state: view.state,
			price: price.price,
			converted: view.converted,
			triggers,
			proposal: proposal?.kind ?? "none",
			by,
			hash,
			dryRun: env.AGENT_DRY_RUN,
		};
		lines.push(line);
		log.info({ ...line }, "cycle");
	}
	if (named.length === 0) log.info({ registry }, "cycle: no positions under the name");
	return { registry, positions: lines };
}
