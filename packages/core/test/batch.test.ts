/**
 * One signature for a whole flow (08 roadmap, the EIP-7702 path): the holder's
 * EOA, delegated to the one account contract the Ledger Ethereum app whitelists,
 * executes every call of a session as a single `executeBatch` on itself — so
 * `msg.sender` inside each call is still the holder, and Aqua's maker is still
 * the Ledger (AGENTS.md, Security: no helper contract ever calls ship). These are
 * the two pure halves: recognising a delegated account from its code, and
 * wrapping a session's calls into the one call the Ledger signs.
 */
import { decodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import {
	batchCall,
	delegateOf,
	demoFlowCalls,
	SIMPLE_7702_ACCOUNT,
	simple7702AccountAbi,
} from "../src";

const holder = "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1" as const;
const input = {
	holder,
	registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
	resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
	agent: "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32",
} as const;

describe("delegateOf — reading the EIP-7702 delegation indicator", () => {
	it("returns the checksummed delegate behind 0xef0100", () => {
		const code = `0xef0100${SIMPLE_7702_ACCOUNT.slice(2).toLowerCase()}` as const;
		expect(delegateOf(code)).toBe(SIMPLE_7702_ACCOUNT);
	});

	it("is null for a plain EOA, for ordinary contract code, and for a malformed indicator", () => {
		expect(delegateOf(undefined)).toBeNull();
		expect(delegateOf("0x")).toBeNull();
		expect(delegateOf("0x6080604052")).toBeNull();
		expect(delegateOf("0xef0100abcd")).toBeNull();
		expect(delegateOf(`0xef0200${SIMPLE_7702_ACCOUNT.slice(2)}`)).toBeNull();
		expect(delegateOf(`0xef0100${"zz".repeat(20)}`)).toBeNull();
	});
});

describe("batchCall — a whole session as one call to self", () => {
	const calls = demoFlowCalls(input).filter(
		(c) => c.kind === "ship" || c.kind === "createPosition",
	);

	it("targets the holder's own address and wraps every call, in order, with zero value", () => {
		const batch = batchCall(holder, calls);
		expect(batch.to).toBe(holder);
		expect(batch.kind).toBe("batch");
		const decoded = decodeFunctionData({ abi: simple7702AccountAbi, data: batch.data });
		expect(decoded.functionName).toBe("executeBatch");
		expect(decoded.args[0]).toEqual(calls.map((c) => ({ target: c.to, value: 0n, data: c.data })));
	});

	it("says what is inside, in the holder's words, and what the Ledger shows", () => {
		const batch = batchCall(holder, calls);
		expect(batch.intent).toContain("2 steps");
		expect(batch.intent).toContain(calls[0]?.ledgerShows ?? "");
		expect(batch.intent).toContain(calls[1]?.ledgerShows ?? "");
		expect(batch.ledgerShows).toBe("Moor: all steps in one");
	});

	it("refuses an empty batch", () => {
		expect(() => batchCall(holder, [])).toThrow(/empty/i);
	});
});
