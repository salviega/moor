import { encodeAbiParameters, encodeFunctionResult } from "viem";
import { describe, expect, it } from "vitest";
import { universalResolverAbi } from "../src/abi";
import { moorSepolia } from "../src/addresses";
import { dnsEncode } from "../src/names";
import {
	type ChainReader,
	parseAgentRecords,
	parsePositionRecords,
	readPositionView,
	readPrice,
	readTextRecords,
} from "../src/reads";
import position from "./fixtures/position-btc-dip.json";

const holder = "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1";
const agent = "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32";
const records: Record<string, string> = {
	"moor.version": "1",
	"moor.strategy": `11155111:${position.strategyHash}`,
	"moor.program": position.data,
	"moor.pair": `${moorSepolia.testUsdc.toLowerCase()}:${moorSepolia.testWbtc.toLowerCase()}`,
	"moor.side": "buy",
	"moor.range": "58000:62000",
	"moor.agent": "agent.salviega.eth",
	"moor.amount": "1000000000",
	"moor.agent.checkedAt": "1788640000",
	"moor.agent.price": "60500",
	"moor.agent.proposal": JSON.stringify({ kind: "none", reasoning: "in range, working" }),
};

/** A stub of the few reads the Live App makes, keyed by function name. */
function stubClient(
	over: Partial<Record<string, (args: readonly unknown[]) => unknown>> = {},
	addrOf: `0x${string}` = position.maker as `0x${string}`,
): ChainReader & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		async readContract({ functionName, args }) {
			calls.push(functionName);
			if (over[functionName]) return over[functionName]?.(args ?? []);
			switch (functionName) {
				case "resolve": {
					// UniversalResolverV2.resolve(name, data): answer text()/addr() from the table above
					const data = (args as [`0x${string}`, `0x${string}`])[1];
					const selector = data.slice(0, 10);
					if (selector === "0x3b3b57de") {
						// addr(bytes32)
						return [
							encodeAbiParameters([{ type: "address" }], [addrOf]),
							moorSepolia.moorRegistrar,
						];
					}
					// text(bytes32,string): the key is the second ABI arg
					const key = Buffer.from(data.slice(10 + 128 + 64, 10 + 128 + 64 + 200), "hex")
						.toString("utf8")
						.replace(/\0+$/, "");
					const value = records[key] ?? "";
					return [encodeAbiParameters([{ type: "string" }], [value]), moorSepolia.moorRegistrar];
				}
				case "safeBalances":
					return [394142217n, 1000000n];
				case "getSubregistry":
					return "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922";
				case "getExpiry":
					return 1791231936n;
				case "latestRoundData":
					return [1n, 7977811990083n, 1788642600n, 1788642672n, 1n];
				case "decimals":
					return 8;
				default:
					throw new Error(`unexpected read ${functionName}`);
			}
		},
	};
}

describe("records → position", () => {
	it("parses the holder's records", () => {
		const p = parsePositionRecords(records);
		expect(p.strategyHash).toBe(position.strategyHash);
		expect(p.side).toBe("buy");
		expect(p.priceMin).toBe("58000");
		expect(p.tokenIn).toBe(moorSepolia.testUsdc.toLowerCase());
		expect(p.amountIn).toBe(1000000000n);
		expect(p.agentName).toBe("agent.salviega.eth");
	});
	it("tolerates a missing moor.amount (positions named before phase 3)", () => {
		const { "moor.amount": _drop, ...older } = records;
		expect(parsePositionRecords(older).amountIn).toBeUndefined();
	});
	it("refuses a name without moor.strategy", () => {
		expect(() => parsePositionRecords({ "moor.version": "1" })).toThrow(/moor.strategy/);
	});
	it("parses agent records and drops an invalid proposal", () => {
		const a = parseAgentRecords(records);
		expect(a.checkedAt).toBe(1788640000);
		expect(a.price).toBe(60500);
		expect(a.proposal?.kind).toBe("none");
		const bad = parseAgentRecords({ ...records, "moor.agent.proposal": "not json" });
		expect(bad.proposal).toBeUndefined();
		expect(bad.proposalError).toMatch(/invalid/);
		expect(parseAgentRecords({}).checkedAt).toBeUndefined();
	});
});

describe("chain reads", () => {
	it("reads text records through UniversalResolverV2 with the DNS-encoded name", async () => {
		const client = stubClient();
		const out = await readTextRecords(client, "btc-dip.salviega.eth", ["moor.side", "moor.range"]);
		expect(out).toEqual({ "moor.side": "buy", "moor.range": "58000:62000" });
		expect(client.calls).toEqual(["resolve", "resolve"]);
	});

	it("assembles a position view: balances, converted fraction, state, expiry", async () => {
		const client = stubClient();
		const v = await readPositionView(client, {
			parentName: "salviega.eth",
			label: "btc-dip",
			price: 60500,
			now: 1788650000,
		});
		expect(v.name).toBe("btc-dip.salviega.eth");
		expect(v.holder).toBe(position.maker);
		expect(v.balanceIn).toBe(394142217n);
		expect(v.balanceOut).toBe(1000000n);
		expect(v.converted).toBeCloseTo(0.6059, 3);
		expect(v.state).toBe("working");
		expect(v.expiry).toBe(1791231936);
		expect(v.makerMatches).toBe(true);
		expect(v.agent.price).toBe(60500);
		expect(client.calls).toContain("safeBalances");
	});

	it("does not ask Aqua for balances when the name's owner is not the maker (Aqua would revert)", async () => {
		const client = stubClient({}, holder);
		const v = await readPositionView(client, {
			parentName: "salviega.eth",
			label: "btc-dip",
			price: 60500,
			now: 1788650000,
		});
		expect(v.holder).toBe(holder);
		expect(v.makerMatches).toBe(false);
		expect(v.balanceIn).toBe(0n);
		expect(client.calls).not.toContain("safeBalances");
	});

	it("is expired past the deadline and closed when the name is gone", async () => {
		const expired = await readPositionView(stubClient(), {
			parentName: "salviega.eth",
			label: "btc-dip",
			price: 60500,
			now: 1791231937,
		});
		expect(expired.state).toBe("expired");
		const closed = await readPositionView(stubClient({ getExpiry: () => 0n }), {
			parentName: "salviega.eth",
			label: "btc-dip",
			price: 60500,
			now: 1788650000,
		});
		expect(closed.state).toBe("closed");
	});

	it("reads the Chainlink price as quote per base", async () => {
		const p = await readPrice(stubClient());
		expect(p.price).toBeCloseTo(79778.12, 1);
		expect(p.updatedAt).toBe(1788642672);
	});

	it("encodes the resolve call the way the contract expects", () => {
		expect(dnsEncode("btc-dip.salviega.eth")).toBe(
			"0x076274632d6469700873616c76696567610365746800",
		);
		const r = encodeFunctionResult({
			abi: universalResolverAbi,
			functionName: "resolve",
			result: ["0x", holder],
		});
		expect(r.startsWith("0x")).toBe(true);
		expect(agent.length).toBe(42);
	});
});
