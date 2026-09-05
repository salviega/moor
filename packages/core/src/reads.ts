/**
 * Everything the Live App and the agent read, derived — never stored (05 §4).
 * Records come through ENSv2's UniversalResolverV2, balances from Aqua, the
 * price from Chainlink; `deriveState` turns them into what the screen shows.
 * The client is the smallest slice of viem's PublicClient, so tests stub it.
 */
import {
	type Abi,
	type Address,
	decodeFunctionResult,
	encodeFunctionData,
	type Hex,
	namehash,
} from "viem";
import {
	aggregatorV3Abi,
	aquaAbi,
	permissionedRegistryAbi,
	permissionedResolverAbi,
	universalResolverAbi,
} from "./abi";
import { chainlinkSepolia, ensV2Sepolia, moorSepolia } from "./addresses";
import { AGENT_LABEL, decodeRange, dnsEncode, fullName, labelId } from "./names";
import { convertedFraction, deriveState, type PositionState, type Side } from "./position";
import { ORDER_TRAITS, sortPair, strategyHash } from "./program";
import {
	agentRecordKeys,
	decodeStrategyRecord,
	Proposal,
	type Proposal as ProposalT,
	positionRecordKeys,
} from "./records";

export interface ChainReader {
	readContract(args: {
		address: Address;
		abi: Abi;
		functionName: string;
		args?: readonly unknown[];
	}): Promise<unknown>;
}

const UR = ensV2Sepolia.universalResolverV2;

async function resolve(client: ChainReader, name: string, data: Hex): Promise<Hex> {
	const [answer] = (await client.readContract({
		address: UR,
		abi: universalResolverAbi,
		functionName: "resolve",
		args: [dnsEncode(name), data],
	})) as [Hex, Address];
	return answer;
}

/** Text records of a name, by key. Missing records come back as "". */
export async function readTextRecords<K extends string>(
	client: ChainReader,
	name: string,
	keys: readonly K[],
): Promise<Record<K, string>> {
	const node = namehash(name);
	const out = {} as Record<K, string>;
	for (const key of keys) {
		const answer = await resolve(
			client,
			name,
			encodeFunctionData({ abi: permissionedResolverAbi, functionName: "text", args: [node, key] }),
		);
		out[key] = decodeFunctionResult({
			abi: permissionedResolverAbi,
			functionName: "text",
			data: answer,
		});
	}
	return out;
}

export async function readAddr(client: ChainReader, name: string): Promise<Address> {
	const answer = await resolve(
		client,
		name,
		encodeFunctionData({
			abi: permissionedResolverAbi,
			functionName: "addr",
			args: [namehash(name)],
		}),
	);
	return decodeFunctionResult({ abi: permissionedResolverAbi, functionName: "addr", data: answer });
}

export interface ParsedPosition {
	version: string;
	chainId: number;
	strategyHash: Hex;
	program: Hex;
	tokenIn: Address;
	tokenOut: Address;
	side: Side;
	priceMin: string;
	priceMax: string;
	agentName: string;
	/** Committed amount of tokenIn, when the name carries moor.amount (positions named from phase 3 on). */
	amountIn?: bigint | undefined;
}

export function parsePositionRecords(r: Record<string, string>): ParsedPosition {
	if (!r["moor.strategy"]) throw new Error("not a Moor position: no moor.strategy record");
	const strategy = decodeStrategyRecord(r["moor.strategy"]);
	const [tokenIn, tokenOut] = (r["moor.pair"] ?? "").split(":") as [Address, Address];
	const range = decodeRange(r["moor.range"] ?? "");
	const side = r["moor.side"] === "sell" ? "sell" : "buy";
	const amount = r["moor.amount"];
	return {
		version: r["moor.version"] ?? "",
		chainId: strategy.chainId,
		strategyHash: strategy.strategyHash as Hex,
		program: (r["moor.program"] ?? "0x") as Hex,
		tokenIn,
		tokenOut,
		side,
		priceMin: range.priceMin,
		priceMax: range.priceMax,
		agentName: r["moor.agent"] ?? "",
		amountIn: amount && /^\d+$/.test(amount) ? BigInt(amount) : undefined,
	};
}

export interface AgentRecords {
	checkedAt?: number | undefined;
	price?: number | undefined;
	state?: string | undefined;
	filled?: string | undefined;
	fees?: string | undefined;
	proposal?: ProposalT | undefined;
	proposalError?: string | undefined;
	reasoning?: string | undefined;
	simulation?: string | undefined;
}

const num = (s: string | undefined) => (s && Number.isFinite(Number(s)) ? Number(s) : undefined);

/** The agent's records are attacker-writable by design: parse, never trust, and say when they do not validate. */
export function parseAgentRecords(r: Record<string, string>): AgentRecords {
	const out: AgentRecords = {
		checkedAt: num(r["moor.agent.checkedAt"]),
		price: num(r["moor.agent.price"]),
		state: r["moor.agent.state"] || undefined,
		filled: r["moor.agent.filled"] || undefined,
		fees: r["moor.agent.fees"] || undefined,
		reasoning: r["moor.agent.reasoning"] || undefined,
		simulation: r["moor.agent.simulation"] || undefined,
	};
	const raw = r["moor.agent.proposal"];
	if (raw) {
		try {
			out.proposal = Proposal.parse(JSON.parse(raw));
		} catch {
			out.proposalError = "the agent wrote an invalid proposal; ignored";
		}
	}
	return out;
}

export interface PositionView extends ParsedPosition {
	name: string;
	label: string;
	holder: Address;
	registry: Address;
	expiry: number;
	balanceIn: bigint;
	balanceOut: bigint;
	/** Whether the holder (the name's addr) is the Aqua maker of the strategy the name points at. */
	makerMatches: boolean;
	amountKnown: boolean;
	converted: number;
	state: PositionState;
	agent: AgentRecords;
}

/** One position, from its name: records, balances, state. `price` is quote per base (readPrice). */
export async function readPositionView(
	client: ChainReader,
	input: { parentName: string; label: string; price: number; now: number },
): Promise<PositionView> {
	const name = fullName(input.parentName, input.label);
	const records = await readTextRecords(client, name, [...positionRecordKeys, ...agentRecordKeys]);
	const parsed = parsePositionRecords(records);
	const agent = parseAgentRecords(records);
	const holder = await readAddr(client, name);
	const parentLabel = input.parentName.replace(/\.eth$/, "");
	const registry = (await client.readContract({
		address: ensV2Sepolia.ethRegistry,
		abi: permissionedRegistryAbi,
		functionName: "getSubregistry",
		args: [parentLabel],
	})) as Address;
	const expiry = Number(
		(await client.readContract({
			address: registry,
			abi: permissionedRegistryAbi,
			functionName: "getExpiry",
			args: [labelId(input.label)],
		})) as bigint,
	);
	const makerMatches =
		strategyHash({ maker: holder, traits: ORDER_TRAITS, data: parsed.program }).toLowerCase() ===
		parsed.strategyHash.toLowerCase();
	const { tokenA, tokenB } = sortPair(parsed.tokenIn, parsed.tokenOut);
	// Aqua reverts on a strategy the maker never shipped, and a name can point at a strategy shipped by
	// another wallet (the phase-1 demo position does). Then the owner's balances are simply zero.
	const [balA, balB] = makerMatches
		? ((await client.readContract({
				address: moorSepolia.aqua,
				abi: aquaAbi,
				functionName: "safeBalances",
				args: [holder, moorSepolia.swapVmRouter, parsed.strategyHash, tokenA, tokenB],
			})) as [bigint, bigint])
		: [0n, 0n];
	const inIsA = parsed.tokenIn.toLowerCase() === tokenA.toLowerCase();
	const balanceIn = inIsA ? balA : balB;
	const balanceOut = inIsA ? balB : balA;
	const amountKnown = parsed.amountIn !== undefined;
	const amountIn = parsed.amountIn ?? balanceIn;
	const state = deriveState({
		exists: expiry > 0,
		now: input.now,
		deadline: expiry,
		balanceIn,
		amountIn,
		price: input.price,
		priceMin: Number(parsed.priceMin),
		priceMax: Number(parsed.priceMax),
	});
	return {
		...parsed,
		name,
		label: input.label,
		holder,
		registry,
		expiry,
		balanceIn,
		balanceOut,
		makerMatches,
		amountKnown,
		converted: convertedFraction(balanceIn, amountIn),
		state,
		agent,
	};
}

/** Chainlink BTC/USD on Sepolia — the price the interface marks the range against (04 §8, decided in phase 3). */
export async function readPrice(
	client: ChainReader,
	feed: Address = chainlinkSepolia.btcUsd,
): Promise<{ price: number; updatedAt: number }> {
	const [, answer, , updatedAt] = (await client.readContract({
		address: feed,
		abi: aggregatorV3Abi,
		functionName: "latestRoundData",
	})) as [bigint, bigint, bigint, bigint, bigint];
	const decimals = (await client.readContract({
		address: feed,
		abi: aggregatorV3Abi,
		functionName: "decimals",
	})) as number;
	return { price: Number(answer) / 10 ** Number(decimals), updatedAt: Number(updatedAt) };
}

export { AGENT_LABEL };
