/**
 * Where the price has been (04 §5, the range ruler): the last N Chainlink rounds,
 * one per hour on Sepolia, fetched in a single Multicall3 call. Round ids are
 * phase-prefixed (phase << 64 | round); the walk stays inside the current phase.
 */
import type { Abi, Address } from "viem";
import { aggregatorV3Abi } from "./abi";
import { chainlinkSepolia } from "./addresses";
import type { ChainReader } from "./reads";

export interface PricePoint {
	price: number;
	updatedAt: number;
}

export interface HistoryClient extends ChainReader {
	multicall(args: {
		contracts: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }[];
		allowFailure: true;
	}): Promise<({ status: "success"; result: unknown } | { status: "failure"; error: Error })[]>;
}

const PHASE_MASK = (1n << 64n) - 1n;

export async function readPriceHistory(
	client: HistoryClient,
	opts: { rounds?: number; feed?: Address } = {},
): Promise<PricePoint[]> {
	const feed = opts.feed ?? chainlinkSepolia.btcUsd;
	const rounds = opts.rounds ?? 48;
	const [latestId, latestAnswer, , latestUpdated] = (await client.readContract({
		address: feed,
		abi: aggregatorV3Abi,
		functionName: "latestRoundData",
	})) as [bigint, bigint, bigint, bigint, bigint];
	const decimals = Number(
		await client.readContract({ address: feed, abi: aggregatorV3Abi, functionName: "decimals" }),
	);
	const scale = 10 ** decimals;
	const inPhase = Number(latestId & PHASE_MASK);
	const back = Math.min(rounds, Math.max(inPhase - 1, 0));
	const ids = Array.from({ length: back }, (_, i) => latestId - BigInt(i + 1));
	const results = back
		? await client.multicall({
				contracts: ids.map((id) => ({
					address: feed,
					abi: aggregatorV3Abi as Abi,
					functionName: "getRoundData",
					args: [id],
				})),
				allowFailure: true,
			})
		: [];
	const points: PricePoint[] = [];
	for (const r of results) {
		if (r.status !== "success") continue;
		const [, answer, , updatedAt] = r.result as [bigint, bigint, bigint, bigint, bigint];
		if (updatedAt === 0n) continue;
		points.push({ price: Number(answer) / scale, updatedAt: Number(updatedAt) });
	}
	points.push({ price: Number(latestAnswer) / scale, updatedAt: Number(latestUpdated) });
	return points.sort((a, b) => a.updatedAt - b.updatedAt);
}
