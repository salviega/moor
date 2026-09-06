import { parseTransaction } from "viem";
import { describe, expect, it } from "vitest";
import { moorSepolia } from "../src/addresses";
import { demoFlow } from "../src/flow";

const input = {
	holder: "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1",
	registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
	resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
	agent: "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32",
} as const;

describe("demo flow for the device screens", () => {
	const flow = demoFlow(input);
	it("is the six signatures of the product, in order", () => {
		expect(flow.map((t) => t.kind)).toEqual([
			"approve",
			"ship",
			"createPosition",
			"dock",
			"unregister",
			"revokeAgent",
		]);
		expect(flow.map((t) => t.expectedStatus)).toEqual([
			"blind_signed",
			...Array(5).fill("clear_signed"),
		]);
	});
	it("serializes unsigned Sepolia transactions whose `to` and `data` are the calls'", () => {
		const ship = parseTransaction(flow[1]?.rawTx ?? "0x");
		expect(ship.chainId).toBe(11155111);
		expect(ship.to?.toLowerCase()).toBe(moorSepolia.aqua.toLowerCase());
		expect(ship.data?.startsWith("0xf50b870f")).toBe(true);
		const revoke = parseTransaction(flow[5]?.rawTx ?? "0x");
		expect(revoke.to?.toLowerCase()).toBe(moorSepolia.moorRegistrar.toLowerCase());
		expect(flow[2]?.expectedTexts).toEqual(["Name Moor position"]);
	});
});
