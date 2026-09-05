import { describe, expect, it } from "vitest";
import {
	agentRecordKeys,
	decodeStrategyRecord,
	encodeStrategyRecord,
	Proposal,
	positionRecordKeys,
} from "../src/records";

const hash = `0x${"ab".repeat(32)}`;

describe("moor.strategy record", () => {
	it("round-trips chainId:strategyHash", () => {
		const encoded = encodeStrategyRecord({ chainId: 11155111, strategyHash: hash });
		expect(encoded).toBe(`11155111:${hash}`);
		expect(decodeStrategyRecord(encoded)).toEqual({ chainId: 11155111, strategyHash: hash });
	});
	it("lowercases the hash on encode", () => {
		expect(
			encodeStrategyRecord({ chainId: 1, strategyHash: hash.toUpperCase().replace("0X", "0x") }),
		).toBe(`1:${hash}`);
	});
	it("rejects extra segments and malformed hashes", () => {
		expect(() => decodeStrategyRecord(`1:${hash}:x`)).toThrow(/malformed/);
		expect(() => decodeStrategyRecord("1:0x1234")).toThrow();
		expect(() => decodeStrategyRecord("nope")).toThrow(/malformed/);
	});
});

describe("record namespaces", () => {
	it("never share a key between the position and the agent", () => {
		for (const k of agentRecordKeys) {
			expect(positionRecordKeys).not.toContain(k);
			expect(k.startsWith("moor.agent.")).toBe(true);
		}
	});
});

describe("Proposal", () => {
	it("accepts a bounded proposal", () => {
		expect(
			Proposal.parse({
				kind: "widen",
				priceMin: "55000",
				priceMax: "65000",
				reasoning: "out of range 3 days",
			}),
		).toMatchObject({ kind: "widen" });
	});
	it("rejects an unknown kind and an oversized reasoning", () => {
		expect(() => Proposal.parse({ kind: "execute", reasoning: "" })).toThrow();
		expect(() => Proposal.parse({ kind: "none", reasoning: "x".repeat(281) })).toThrow();
	});
});
