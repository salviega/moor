/**
 * The agent (04 §4.4, 05 §8): headless, every 300 s, no memory it cannot lose.
 * Each cycle starts from the chain — price, names, balances — derives with
 * @moor/core, and writes moor.agent.* on each position name through one
 * multicall on the holder's resolver. That is the whole of what it can do; the
 * negative-role tests in packages/contracts are what say so. It never builds,
 * signs or sends anything to Aqua, the registry or the holder's records, and
 * there is no code path here that could.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
	agentRecordValues,
	agentSetTextCall,
	buildReading,
	demoPair,
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
	shouldPropose,
	simulate,
} from "@moor/core";
import pino from "pino";
import { type Address, createPublicClient, createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { loadEnv } from "./env";
import { proposeWithClaude } from "./model";

const log = pino({ name: "moor-agent" });
const once = process.argv.includes("--once");
const env = loadEnv();
const account = privateKeyToAccount(env.AGENT_PRIVATE_KEY as Hex);
const publicClient = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
const walletClient = createWalletClient({
	account,
	chain: sepolia,
	transport: http(env.SEPOLIA_RPC_URL),
});
const anthropic = env.ANTHROPIC_API_KEY
	? new Anthropic({
			apiKey: env.ANTHROPIC_API_KEY,
			...(env.ANTHROPIC_WORKSPACE_ID
				? { defaultHeaders: { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } }
				: {}),
		})
	: null;
const parentLabel = env.AGENT_PARENT_NAME.replace(/\.eth$/, "");

/** eth_getLogs in chunks: the holder's registry is young and small, the RPC's range limit is the constraint. */
const logsClient: LogsClient = {
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

async function propose(
	view: PositionView,
	price: number,
	now: number,
): Promise<{ proposal: Proposal; simulation: string; by: "claude" | "deterministic" }> {
	const triggers = detectTriggers(view, price, now);
	const fallback = deterministicProposal(triggers[0] ?? "farFromRange", view, price, now);
	if (anthropic) {
		try {
			const answer = await proposeWithClaude(
				anthropic,
				env.AGENT_MODEL,
				proposalPrompt(view, price, now, triggers, demoPair),
			);
			if (answer) {
				const proposal = { ...answer, trigger: answer.trigger ?? triggers[0] };
				return { proposal, simulation: simulate(view, price, proposal, demoPair), by: "claude" };
			}
			log.warn(
				{ name: view.name },
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
		simulation: simulate(view, price, fallback, demoPair),
		by: "deterministic",
	};
}

async function cycle(): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
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
		listPositions(logsClient, { registry, registrar: moorSepolia.moorRegistrar }),
		readPrice(publicClient),
	]);
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
			const p = await propose(view, price.price, now);
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
		log.info(
			{
				position: view.name,
				state: view.state,
				price: price.price,
				converted: view.converted,
				triggers,
				proposal: proposal?.kind ?? "none",
				by,
				hash,
				dryRun: env.AGENT_DRY_RUN,
			},
			"cycle",
		);
	}
	if (named.length === 0) log.info({ registry }, "cycle: no positions under the name");
}

async function main(): Promise<void> {
	log.info(
		{
			agent: account.address,
			parent: env.AGENT_PARENT_NAME,
			intervalSeconds: env.AGENT_INTERVAL_SECONDS,
			model: anthropic ? env.AGENT_MODEL : "none (deterministic)",
			once,
			dryRun: env.AGENT_DRY_RUN,
		},
		"agent starting",
	);
	await cycle();
	if (once) return;
	setInterval(() => {
		cycle().catch((err) => log.error({ err }, "cycle failed; the position keeps working"));
	}, env.AGENT_INTERVAL_SECONDS * 1_000);
}

main().catch((err) => {
	log.fatal({ err }, "agent could not start");
	process.exit(1);
});
