/**
 * The Live App signs a session as one call when — and only when — the holder's
 * account is delegated to the account contract the Ledger app accepts (08 §2.3).
 * A plain EOA, a foreign delegate, or a single-call session all sign exactly as
 * before: the batch is an opt-in the holder made on chain, never a default.
 */
import { describe, expect, it } from "vitest";
import { demoFlowCalls, SIMPLE_7702_ACCOUNT, sessionCalls } from "../src";

const holder = "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1" as const;
const calls = demoFlowCalls({
	holder,
	registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
	resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
	agent: "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32",
});
const open = calls.filter((c) => c.kind === "ship" || c.kind === "createPosition");
const delegated = `0xef0100${SIMPLE_7702_ACCOUNT.slice(2).toLowerCase()}` as const;

describe("sessionCalls — batch only when the holder opted in on chain", () => {
	it("wraps a multi-call session into one batch when delegated to Simple7702Account", () => {
		const out = sessionCalls({ holder, code: delegated, calls: open });
		expect(out).toHaveLength(1);
		expect(out[0]?.kind).toBe("batch");
		expect(out[0]?.to).toBe(holder);
	});

	it("leaves a plain EOA's session exactly as it was", () => {
		expect(sessionCalls({ holder, code: "0x", calls: open })).toBe(open);
		expect(sessionCalls({ holder, code: undefined, calls: open })).toBe(open);
	});

	it("does not batch through a delegate the Ledger app does not accept", () => {
		const foreign = `0xef0100${"ab".repeat(20)}` as const;
		expect(sessionCalls({ holder, code: foreign, calls: open })).toBe(open);
	});

	it("never wraps a single call — one signature is already one signature", () => {
		const one = open.slice(0, 1);
		expect(sessionCalls({ holder, code: delegated, calls: one })).toBe(one);
	});
});
