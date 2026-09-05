import { decodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { aquaAbi, moorRegistrarAbi } from "../src/abi";
import { moorSepolia } from "../src/addresses";
import {
	approveCall,
	closeCalls,
	planNewPosition,
	positionRecords,
	revokeAgentCall,
	setupAgentCall,
} from "../src/session";
import position from "./fixtures/position-btc-dip.json";
import txs from "./fixtures/sepolia-txs.json";

/** The phase-1 position as the holder would have typed it (04 §4.1). */
const typed = {
	parentName: "salviega.eth",
	label: "btc-dip",
	side: "buy" as const,
	priceMin: "58000",
	priceMax: "62000",
	amountIn: "1000000000",
	feeBps: 30,
	deadline: 1791231936,
};
const pair = {
	base: { address: moorSepolia.testWbtc, decimals: 8, symbol: "tWBTC" },
	quote: { address: moorSepolia.testUsdc, decimals: 6, symbol: "tUSDC" },
};
const maker = position.maker as `0x${string}`;
const names = {
	registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
	resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
} as const;

describe("planNewPosition — parity with what is on Sepolia", () => {
	const plan = planNewPosition({ holder: maker, pair, params: typed, allowance: 0n, names });

	it("reproduces the strategyHash of the shipped position", () => {
		expect(plan.strategyHash).toBe(position.strategyHash);
		expect(plan.order.data).toBe(position.data);
	});

	it("reproduces the calldata of the real ship transaction byte for byte", () => {
		const ship = plan.calls.find((c) => c.kind === "ship");
		expect(ship?.to.toLowerCase()).toBe(txs.ship.to);
		expect(ship?.data).toBe(txs.ship.input);
	});

	it("puts an approve first only when the allowance is short", () => {
		expect(plan.calls.map((c) => c.kind)).toEqual(["approve", "ship", "createPosition"]);
		const approved = planNewPosition({
			holder: maker,
			pair,
			params: typed,
			allowance: 2n ** 255n,
			names,
		});
		expect(approved.calls.map((c) => c.kind)).toEqual(["ship", "createPosition"]);
		const approve = plan.calls[0];
		const decoded = decodeFunctionData({ abi: aquaAbi, data: approve?.data ?? "0x" });
		expect(decoded.functionName).toBe("approve");
		expect(decoded.args).toEqual([moorSepolia.aqua, 2n ** 256n - 1n]);
		expect(approve?.to).toBe(pair.quote.address);
	});

	it("writes the same records the holder signed on Sepolia, plus moor.amount", () => {
		const onChain = decodeFunctionData({
			abi: moorRegistrarAbi,
			data: txs.createPosition.input as `0x${string}`,
		});
		expect(onChain.functionName).toBe("createPosition");
		const [registry, resolver, parentName, label, expiry, records] = onChain.args as [
			`0x${string}`,
			`0x${string}`,
			string,
			string,
			bigint,
			{ key: string; value: string }[],
		];
		expect(parentName).toBe(typed.parentName);
		expect(label).toBe(typed.label);
		expect(expiry).toBe(BigInt(typed.deadline));
		const mine = positionRecords({
			pair,
			params: typed,
			strategyHash: plan.strategyHash,
			program: plan.order.data,
		});
		expect(mine.slice(0, records.length)).toEqual(records);
		expect(mine.at(-1)).toEqual({ key: "moor.amount", value: typed.amountIn });
		// and the createPosition call in the plan targets the registrar with those records
		const cp = plan.calls.find((c) => c.kind === "createPosition");
		const re = decodeFunctionData({ abi: moorRegistrarAbi, data: cp?.data ?? "0x" });
		expect(re.args?.[5]).toEqual(mine);
		expect(re.args?.[0]).toBe(plan.registry);
		expect(typeof registry).toBe("string");
		expect(typeof resolver).toBe("string");
	});

	it("sells the other way round: a sell position spends the base and lets takers bring the quote", () => {
		const sell = planNewPosition({
			holder: maker,
			pair,
			params: { ...typed, side: "sell", amountIn: "100000000" },
			allowance: 0n,
		});
		expect(sell.calls[0]?.to).toBe(pair.base.address);
		expect(sell.strategyHash).not.toBe(plan.strategyHash);
		const rec = Object.fromEntries(sell.records.map((r) => [r.key, r.value]));
		expect(rec["moor.side"]).toBe("sell");
		expect(rec["moor.pair"]).toBe(
			`${pair.base.address.toLowerCase()}:${pair.quote.address.toLowerCase()}`,
		);
	});

	it("rejects an invalid form", () => {
		expect(() =>
			planNewPosition({
				holder: maker,
				pair,
				params: { ...typed, priceMin: "70000" },
				allowance: 0n,
			}),
		).toThrow();
	});
});

describe("the other sessions", () => {
	it("setupAgent matches the real transaction", () => {
		const call = setupAgentCall({
			registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
			resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
			parentName: "salviega.eth",
			agent: "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32",
			expiry: 1851716592,
		});
		expect(call.to.toLowerCase()).toBe(txs.setupAgent.to);
		expect(call.data).toBe(txs.setupAgent.input);
	});

	it("close = dock on Aqua, then unregister the name", () => {
		const calls = closeCalls({
			strategyHash: position.strategyHash as `0x${string}`,
			tokens: [pair.quote.address, pair.base.address],
			registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
			label: "btc-dip",
		});
		expect(calls.map((c) => c.kind)).toEqual(["dock", "unregister"]);
		const dock = decodeFunctionData({ abi: aquaAbi, data: calls[0]?.data ?? "0x" });
		expect(dock.args).toEqual([
			moorSepolia.swapVmRouter,
			position.strategyHash,
			[pair.quote.address, pair.base.address],
		]);
	});

	it("revokeAgent and approve target the right contracts", () => {
		const r = revokeAgentCall({
			resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
			agent: "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32",
		});
		expect(r.to).toBe(moorSepolia.moorRegistrar);
		expect(r.kind).toBe("revokeAgent");
		const a = approveCall({ token: pair.quote.address, amount: 5n });
		expect(decodeFunctionData({ abi: aquaAbi, data: a.data }).args).toEqual([moorSepolia.aqua, 5n]);
	});
});
