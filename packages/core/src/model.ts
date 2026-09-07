/**
 * The model call's pure halves (06 §5). The agent asks Groq to fill the shared
 * Proposal schema in strict JSON Schema mode; the schema here is derived from
 * the Zod one so it is never written twice, then cut down to the keywords strict
 * mode accepts. What comes back still crosses Zod — the schema mode is a
 * convenience, Zod is the trust boundary (AGENTS.md, Security) — and anything
 * that does not validate is null. Null is never written.
 */
import { z } from "zod";
import { Proposal } from "./records";

type JsonObject = Record<string, unknown>;

export interface StrictObjectSchema {
	type: "object";
	properties: Record<string, unknown>;
	required: string[];
	additionalProperties: false;
}

/** What strict mode understands. `pattern`, lengths and bounds are dropped: Zod enforces them on the way back. */
const KEEP = new Set([
	"type",
	"enum",
	"const",
	"properties",
	"required",
	"additionalProperties",
	"anyOf",
	"items",
	"description",
]);

function strict(node: JsonObject): JsonObject {
	const out: JsonObject = {};
	for (const [k, v] of Object.entries(node)) if (KEEP.has(k)) out[k] = v;
	if (out.type === "object" && out.properties && typeof out.properties === "object") {
		const required = new Set((node.required as string[] | undefined) ?? []);
		const properties: Record<string, unknown> = {};
		for (const [name, p] of Object.entries(out.properties as Record<string, JsonObject>)) {
			const s = strict(p);
			// Strict mode wants every key present; what Proposal marks optional the model says as null.
			properties[name] = required.has(name) ? s : { anyOf: [s, { type: "null" }] };
		}
		out.properties = properties;
		out.required = Object.keys(properties);
		out.additionalProperties = false;
	}
	if (Array.isArray(out.anyOf)) out.anyOf = (out.anyOf as JsonObject[]).map(strict);
	if (out.items && typeof out.items === "object") out.items = strict(out.items as JsonObject);
	return out;
}

/** The JSON Schema Groq is asked to fill, derived from `Proposal`. */
export function proposalOutputSchema(): StrictObjectSchema {
	return strict(
		z.toJSONSchema(Proposal, { io: "input" }) as JsonObject,
	) as unknown as StrictObjectSchema;
}

/** One chat completion, no streaming, the strict schema by name. Model-agnostic within Groq's strict-capable ones. */
export function groqProposalRequest(model: string, prompt: { system: string; user: string }) {
	return {
		model,
		messages: [
			{ role: "system" as const, content: prompt.system },
			{ role: "user" as const, content: prompt.user },
		],
		response_format: {
			type: "json_schema" as const,
			json_schema: { name: "proposal", strict: true as const, schema: proposalOutputSchema() },
		},
		max_completion_tokens: 2048,
		stream: false as const,
	};
}

/** The completion body → a Proposal, or null when anything about it would not be written. */
export function parseProposalAnswer(body: unknown): Proposal | null {
	if (!body || typeof body !== "object") return null;
	const choices = (body as { choices?: unknown }).choices;
	if (!Array.isArray(choices) || choices.length === 0) return null;
	const message = (choices[0] as { message?: unknown }).message;
	if (!message || typeof message !== "object") return null;
	const content = (message as { content?: unknown }).content;
	if (typeof content !== "string") return null;
	let raw: unknown;
	try {
		raw = JSON.parse(content);
	} catch {
		return null;
	}
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const withoutNulls = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null));
	const parsed = Proposal.safeParse(withoutNulls);
	return parsed.success ? parsed.data : null;
}
