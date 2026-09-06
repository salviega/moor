import { decodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { permissionedResolverAbi } from "../src/abi";
import { moorSepolia } from "../src/addresses";
import {
	acceptProposalCalls,
	agentRecordValues,
	agentSetTextCall,
	buildReading,
	detectTriggers,
	deterministicProposal,
	nextLabel,
	proposalPrompt,
	shouldPropose,
	simulate,
} from "../src/agent";
import type { PositionView } from "../src/reads";
import { Proposal } from "../src/records";

const now = 1_788_700_000;
const base: PositionView = {
	version: "1",
	chainId: 11155111,
	strategyHash: "0xe803dd796833f17bcfbaea9966c5ac7741f283d7f81cb7c87b311515b946c71f",
	program: "0x",
	tokenIn: moorSepolia.testUsdc,
	tokenOut: moorSepolia.testWbtc,
	side: "buy",
	priceMin: "58000",
	priceMax: "62000",
	agentName: "agent.salviega.eth",
	amountIn: 1_000_000_000n,
	name: "btc-dip-2.salviega.eth",
	label: "btc-dip-2",
	holder: "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1",
	registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
	expiry: now + 30 * 86_400,
	balanceIn: 1_000_000_000n,
	balanceOut: 0n,
	makerMatches: true,
	amountKnown: true,
	converted: 0,
	state: "waiting",
	agent: {},
};
const pair = {
	base: { address: moorSepolia.testWbtc, decimals: 8, symbol: "tWBTC" },
	quote: { address: moorSepolia.testUsdc, decimals: 6, symbol: "tUSDC" },
};

describe("thresholds (04 §4.4, fixed v1)", () => {
	it("is quiet when the price sits near the range and nothing else happened", () => {
		expect(detectTriggers(base, 63_000, now)).toEqual([]);
	});
	it("fires farFromRange when the price is more than 10 % away from the range while waiting", () => {
		expect(detectTriggers(base, 79_900, now)).toEqual(["farFromRange"]);
		expect(detectTriggers({ ...base, state: "working", converted: 0.2 }, 79_900, now)).toEqual([]);
	});
	it("fires completed and expiring", () => {
		expect(detectTriggers({ ...base, state: "completed", converted: 1 }, 60_000, now)).toEqual([
			"completed",
		]);
		expect(detectTriggers({ ...base, expiry: now + 3600 }, 60_000, now)).toEqual(["expiring"]);
		expect(detectTriggers({ ...base, state: "closed" }, 60_000, now)).toEqual([]);
	});
	it("proposes once per trigger: an existing proposal for the same trigger is kept", () => {
		expect(shouldPropose(["farFromRange"], {})).toBe(true);
		expect(
			shouldPropose(["farFromRange"], {
				proposal: { kind: "widen", reasoning: "x", trigger: "farFromRange" },
			}),
		).toBe(false);
		expect(
			shouldPropose(["completed"], {
				proposal: { kind: "widen", reasoning: "x", trigger: "farFromRange" },
			}),
		).toBe(true);
		expect(
			shouldPropose([], { proposal: { kind: "widen", reasoning: "x", trigger: "farFromRange" } }),
		).toBe(false);
	});
});

describe("the reading and the deterministic proposal (the cut 07 allows)", () => {
	it("builds the reading the agent writes every cycle", () => {
		const r = buildReading({ ...base, converted: 0.25, state: "working" }, 60_500.123, now);
		expect(r).toEqual({
			checkedAt: String(now),
			price: "60500.12",
			state: "working",
			filled: "25.0%",
		});
	});
	it("widens toward the price when far from range, keeping the width, for a buy", () => {
		const p = deterministicProposal("farFromRange", base, 79_900, now);
		expect(p.kind).toBe("widen");
		expect(p.trigger).toBe("farFromRange");
		expect(Number(p.priceMax)).toBeLessThan(79_900);
		expect(Number(p.priceMax) - Number(p.priceMin)).toBe(4000);
		expect(Proposal.parse(p)).toEqual(p);
	});
	it("closes when completed and renews when expiring", () => {
		expect(deterministicProposal("completed", base, 60_000, now).kind).toBe("close");
		const r = deterministicProposal("expiring", base, 60_000, now);
		expect(r.kind).toBe("renew");
		expect(r.deadline).toBe(now + 30 * 86_400);
	});
	it("simulates in plain words with the numbers a holder needs", () => {
		const p = deterministicProposal("farFromRange", base, 79_900, now);
		const s = simulate(base, 79_900, p, pair);
		expect(s).toMatch(/1,000 tUSDC/);
		expect(s).toMatch(/below the price/);
	});
	it("writes a prompt that carries the reading, the candidates and the schema's vocabulary", () => {
		const { system, user } = proposalPrompt(base, 79_900, now, ["farFromRange"], pair);
		expect(system).toMatch(/never move|cannot move/i);
		expect(user).toMatch(/btc-dip-2\.salviega\.eth/);
		expect(user).toMatch(/none|widen|narrow|close|renew/);
	});
});

describe("what the agent writes", () => {
	it("maps the reading and the proposal to the eight moor.agent.* keys", () => {
		const p = deterministicProposal("completed", base, 60_000, now);
		const v = agentRecordValues(buildReading(base, 60_000, now), p, "sim text");
		expect(Object.keys(v).sort()).toEqual([
			"moor.agent.checkedAt",
			"moor.agent.fees",
			"moor.agent.filled",
			"moor.agent.price",
			"moor.agent.proposal",
			"moor.agent.reasoning",
			"moor.agent.simulation",
			"moor.agent.state",
		]);
		expect(JSON.parse(v["moor.agent.proposal"])).toEqual(p);
		expect(v["moor.agent.simulation"]).toBe("sim text");
		const quiet = agentRecordValues(buildReading(base, 60_000, now));
		expect(JSON.parse(quiet["moor.agent.proposal"]).kind).toBe("none");
	});
	it("packs every setText into one multicall on the resolver", () => {
		const v = agentRecordValues(buildReading(base, 60_000, now));
		const call = agentSetTextCall("0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3", base.name, v);
		expect(call.to).toBe("0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3");
		const { functionName, args } = decodeFunctionData({
			abi: permissionedResolverAbi,
			data: call.data,
		});
		expect(functionName).toBe("multicall");
		const inner = (args as [readonly `0x${string}`[]])[0].map((d) =>
			decodeFunctionData({ abi: permissionedResolverAbi, data: d }),
		);
		expect(inner).toHaveLength(8);
		expect(inner.every((i) => i.functionName === "setText")).toBe(true);
		expect(inner.map((i) => i.args?.[1])).toContain("moor.agent.checkedAt");
	});
});

describe("accepting a proposal (04 §4.4 step 5)", () => {
	it("names the successor with a counter", () => {
		expect(nextLabel("btc-dip")).toBe("btc-dip-2");
		expect(nextLabel("btc-dip-2")).toBe("btc-dip-3");
	});
	it("close = dock + unregister; widen/renew = close, then ship and name the successor with what is left", async () => {
		const names = {
			registry: base.registry,
			resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
		} as const;
		const close = acceptProposalCalls({
			view: base,
			proposal: { kind: "close", reasoning: "done" },
			pair,
			names,
			allowance: 0n,
			now,
		});
		expect(close.map((c) => c.kind)).toEqual(["dock", "unregister"]);
		const widen = acceptProposalCalls({
			view: { ...base, balanceIn: 400_000_000n },
			proposal: { kind: "widen", priceMin: "70000", priceMax: "74000", reasoning: "closer" },
			pair,
			names,
			allowance: 2n ** 255n,
			now,
		});
		expect(widen.map((c) => c.kind)).toEqual(["dock", "unregister", "ship", "createPosition"]);
		const cp = decodeFunctionData({
			abi: (await import("../src/abi")).moorRegistrarAbi,
			data: widen[3]?.data ?? "0x",
		});
		const records = cp.args?.[5] as { key: string; value: string }[];
		expect(records.find((r) => r.key === "moor.range")?.value).toBe("70000:74000");
		expect(records.find((r) => r.key === "moor.amount")?.value).toBe("400000000");
		expect(cp.args?.[3]).toBe("btc-dip-3");
	});
});

describe("the other branches", () => {
	const sell: PositionView = {
		...base,
		side: "sell",
		tokenIn: moorSepolia.testWbtc,
		tokenOut: moorSepolia.testUsdc,
		priceMin: "90000",
		priceMax: "95000",
		balanceIn: 100_000_000n,
		amountIn: 100_000_000n,
	};
	it("a sell far below its range moves the range just above the price", () => {
		expect(detectTriggers(sell, 79_900, now)).toEqual(["farFromRange"]);
		const p = deterministicProposal("farFromRange", sell, 79_900, now);
		expect(Number(p.priceMin)).toBeGreaterThan(79_900);
		expect(Number(p.priceMax) - Number(p.priceMin)).toBe(5000);
		expect(simulate(sell, 79_900, p, pair)).toMatch(/above the price/);
		expect(simulate(sell, 79_900, p, pair)).toMatch(/1 tWBTC/);
	});
	it("in range or already trading, nothing fires; an expired position is not 'expiring'", () => {
		expect(detectTriggers(sell, 92_000, now)).toEqual([]);
		expect(detectTriggers({ ...base, state: "expired", expiry: now - 10 }, 79_900, now)).toEqual(
			[],
		);
		expect(detectTriggers({ ...base, expiry: 0 }, 60_000, now)).toEqual([]);
	});
	it("simulates narrow, renew and none, and falls back to the position's own numbers", () => {
		expect(
			simulate(
				base,
				60_000,
				{ kind: "narrow", priceMin: "59000", priceMax: "61000", reasoning: "x" },
				pair,
			),
		).toMatch(/Narrow the range to 59,000–61,000/);
		expect(simulate(base, 60_000, { kind: "widen", reasoning: "x" }, pair)).toMatch(
			/58,000–62,000/,
		);
		expect(
			simulate(
				base,
				60_000,
				{ kind: "renew", deadline: Math.floor(Date.now() / 1000) + 30 * 86_400, reasoning: "x" },
				pair,
			),
		).toMatch(/30 more days/);
		expect(simulate(base, 60_000, { kind: "renew", reasoning: "x" }, pair)).toMatch(/30 more days/);
		expect(simulate(base, 60_000, { kind: "none", reasoning: "x" }, pair)).toBe("No change.");
	});
	it("accepting renew keeps the range and takes the proposed deadline; without one it extends", () => {
		const names = {
			registry: base.registry,
			resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
		} as const;
		const renew = acceptProposalCalls({
			view: base,
			proposal: { kind: "renew", deadline: now + 40 * 86_400, reasoning: "r" },
			pair,
			names,
			allowance: 2n ** 255n,
			now,
		});
		expect(renew.map((c) => c.kind)).toEqual(["dock", "unregister", "ship", "createPosition"]);
		const none = acceptProposalCalls({
			view: base,
			proposal: { kind: "none", reasoning: "r" },
			pair,
			names,
			allowance: 0n,
			now,
		});
		expect(none.map((c) => c.kind)).toEqual(["dock", "unregister"]);
		const narrow = acceptProposalCalls({
			view: { ...base, expiry: now + 5 * 86_400 },
			proposal: { kind: "narrow", reasoning: "r" },
			pair,
			names,
			allowance: 0n,
			now,
		});
		expect(narrow.map((c) => c.kind)).toEqual([
			"dock",
			"unregister",
			"approve",
			"ship",
			"createPosition",
		]);
	});
	it("prompt candidates carry their simulation; reading keeps two decimals", () => {
		const { user } = proposalPrompt(
			{ ...base, state: "completed", converted: 1 },
			60_000,
			now,
			["completed", "expiring"],
			pair,
		);
		expect(JSON.parse(user).candidates).toHaveLength(2);
		expect(buildReading(base, 60_000, now).price).toBe("60000.00");
	});
});
