/**
 * The model call's two pure halves (06 §5): the strict JSON Schema Groq is
 * asked to fill, derived from the shared Proposal schema so it is never written
 * twice, and the parse of what comes back — which still crosses Zod, because the
 * schema mode is a convenience and Zod is the trust boundary (AGENTS.md,
 * Security). Anything that does not validate is null, and null is never written.
 */
import { describe, expect, it } from "vitest";
import { groqProposalRequest, parseProposalAnswer, proposalOutputSchema } from "../src/model";

type Node = Record<string, unknown>;

function walk(node: unknown, visit: (n: Node) => void): void {
	if (Array.isArray(node)) {
		for (const n of node) walk(n, visit);
	} else if (node && typeof node === "object") {
		visit(node as Node);
		for (const v of Object.values(node as Node)) walk(v, visit);
	}
}

const answer = (content: unknown, extra: Record<string, unknown> = {}) => ({
	choices: [{ message: { role: "assistant", content }, finish_reason: "stop", ...extra }],
});

describe("the output schema Groq is asked to fill (strict mode)", () => {
	const schema = proposalOutputSchema();

	it("is one object with every key required and nothing extra allowed", () => {
		expect(schema.type).toBe("object");
		expect(schema.additionalProperties).toBe(false);
		expect(schema.required).toEqual([
			"kind",
			"priceMin",
			"priceMax",
			"deadline",
			"reasoning",
			"trigger",
		]);
		expect((schema.properties.kind as Node).enum).toEqual([
			"none",
			"widen",
			"narrow",
			"close",
			"renew",
		]);
	});

	it("lets the model say null for what Proposal marks optional, and only for that", () => {
		const nullable = (key: string) => {
			const p = schema.properties[key] as Node;
			const arms = p.anyOf as Node[] | undefined;
			return arms !== undefined && arms.some((a) => a.type === "null");
		};
		expect(nullable("priceMin")).toBe(true);
		expect(nullable("priceMax")).toBe(true);
		expect(nullable("deadline")).toBe(true);
		expect(nullable("trigger")).toBe(true);
		expect(nullable("kind")).toBe(false);
		expect(nullable("reasoning")).toBe(false);
	});

	it("carries only the keywords strict mode accepts — Zod keeps the regex, the length and the sign", () => {
		const forbidden = [
			"pattern",
			"maxLength",
			"minLength",
			"minimum",
			"exclusiveMinimum",
			"$schema",
			"format",
		];
		walk(schema, (n) => {
			for (const k of forbidden) expect(n).not.toHaveProperty(k);
			if (n.type === "object") {
				expect(n.additionalProperties).toBe(false);
				expect(n.required).toEqual(Object.keys(n.properties as Node));
			}
		});
	});
});

describe("the request", () => {
	it("is one chat completion: system + user, the model, the strict schema by name", () => {
		const req = groqProposalRequest("openai/gpt-oss-120b", { system: "S", user: "U" });
		expect(req.model).toBe("openai/gpt-oss-120b");
		expect(req.messages).toEqual([
			{ role: "system", content: "S" },
			{ role: "user", content: "U" },
		]);
		expect(req.response_format.type).toBe("json_schema");
		expect(req.response_format.json_schema.strict).toBe(true);
		expect(req.response_format.json_schema.name).toBe("proposal");
		expect(req.response_format.json_schema.schema).toEqual(proposalOutputSchema());
		expect(req.stream).toBe(false);
	});
});

describe("parsing what comes back", () => {
	it("returns the proposal with the model's nulls dropped, so it is the same shape core writes", () => {
		const content = JSON.stringify({
			kind: "widen",
			priceMin: "58000",
			priceMax: "64000",
			deadline: null,
			reasoning: "Price sat 10 % above the range for six days; a wider range restarts activity.",
			trigger: "farFromRange",
		});
		expect(parseProposalAnswer(answer(content))).toEqual({
			kind: "widen",
			priceMin: "58000",
			priceMax: "64000",
			reasoning: "Price sat 10 % above the range for six days; a wider range restarts activity.",
			trigger: "farFromRange",
		});
	});

	it("keeps a plain none with nothing else", () => {
		const content = JSON.stringify({
			kind: "none",
			priceMin: null,
			priceMax: null,
			deadline: null,
			reasoning: "Nothing to do.",
			trigger: null,
		});
		expect(parseProposalAnswer(answer(content))).toEqual({
			kind: "none",
			reasoning: "Nothing to do.",
		});
	});

	it("is null for anything Zod would not write: bad kind, non-numeric price, long reasoning", () => {
		const base = { priceMin: null, priceMax: null, deadline: null, trigger: null };
		expect(
			parseProposalAnswer(answer(JSON.stringify({ ...base, kind: "sell", reasoning: "x" }))),
		).toBeNull();
		expect(
			parseProposalAnswer(
				answer(JSON.stringify({ ...base, kind: "widen", priceMin: "58k", reasoning: "x" })),
			),
		).toBeNull();
		expect(
			parseProposalAnswer(
				answer(JSON.stringify({ ...base, kind: "none", reasoning: "y".repeat(281) })),
			),
		).toBeNull();
	});

	it("is null when there is no usable content: malformed JSON, a non-object, no choice, no string", () => {
		expect(parseProposalAnswer(answer("{not json"))).toBeNull();
		expect(parseProposalAnswer(answer("[]"))).toBeNull();
		expect(parseProposalAnswer(answer("null"))).toBeNull();
		expect(parseProposalAnswer(answer("42"))).toBeNull();
		expect(parseProposalAnswer(answer(null))).toBeNull();
		expect(parseProposalAnswer({ choices: [{}] })).toBeNull();
		expect(parseProposalAnswer({ choices: [] })).toBeNull();
		expect(parseProposalAnswer({})).toBeNull();
		expect(parseProposalAnswer(undefined)).toBeNull();
		expect(parseProposalAnswer("text")).toBeNull();
	});
});
