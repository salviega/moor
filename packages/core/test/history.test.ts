import { getAbiItem } from "viem";
import { describe, expect, it } from "vitest";
import { aggregatorV3Abi } from "../src/abi";
import { chainlinkSepolia } from "../src/addresses";
import { type HistoryClient, readPriceHistory } from "../src/history";

const latestRound = (1n << 64n) | 33605n;
function stub(failAt: number[] = []): HistoryClient & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		async readContract({ functionName }) {
			calls.push(functionName);
			if (functionName === "latestRoundData")
				return [latestRound, 7964724200000n, 0n, 1788708360n, latestRound];
			if (functionName === "decimals") return 8;
			throw new Error(functionName);
		},
		async multicall({ contracts }) {
			calls.push(`multicall:${contracts.length}`);
			return contracts.map((c, i) => {
				const rid = (c.args as [bigint])[0];
				const back = Number(latestRound - rid);
				if (failAt.includes(back)) return { status: "failure", error: new Error("no data") };
				return {
					status: "success",
					result: [
						rid,
						7964724200000n - BigInt(back) * 10_000_000_000n,
						0n,
						1788708360n - BigInt(back) * 3600n,
						rid,
					],
				};
			});
		},
	};
}

describe("price history from Chainlink rounds", () => {
	it("encodes getRoundData with the real ABI (the stub above cannot catch a missing fragment)", () => {
		expect(getAbiItem({ abi: aggregatorV3Abi, name: "getRoundData" })).toBeDefined();
	});
	it("reads the latest round and the N before it in one multicall, oldest first", async () => {
		const client = stub();
		const points = await readPriceHistory(client, { rounds: 4 });
		expect(client.calls).toEqual(["latestRoundData", "decimals", "multicall:4"]);
		expect(points).toHaveLength(5);
		expect(points.map((p) => p.updatedAt)).toEqual([
			1788693960, 1788697560, 1788701160, 1788704760, 1788708360,
		]);
		expect(points.at(-1)?.price).toBeCloseTo(79647.24, 2);
		expect(points[0]?.price).toBeCloseTo(79247.24, 2);
	});
	it("skips rounds the feed cannot return and never crosses a phase boundary", async () => {
		const points = await readPriceHistory(stub([2]), { rounds: 3 });
		expect(points).toHaveLength(3);
		const early = await readPriceHistory(
			{
				...stub(),
				async readContract({ functionName }) {
					if (functionName === "latestRoundData") return [(1n << 64n) | 2n, 1n, 0n, 10n, 0n];
					return 8;
				},
			},
			{ rounds: 10, feed: chainlinkSepolia.btcUsd },
		);
		expect(early).toHaveLength(2);
	});
});
