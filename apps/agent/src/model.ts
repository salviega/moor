/**
 * The one call per proposal (06 §5): a Groq chat completion asked to fill the
 * Proposal schema in strict JSON Schema mode — plain fetch against the
 * OpenAI-compatible endpoint, no SDK to carry. What comes back crosses Zod in
 * core (`parseProposalAnswer`): anything that does not validate is null and the
 * caller falls back to the deterministic proposal. Nothing here is written.
 */
import { groqProposalRequest, type Proposal, parseProposalAnswer } from "@moor/core";

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function proposeWithGroq(
	apiKey: string,
	model: string,
	prompt: { system: string; user: string },
	fetchImpl: typeof fetch = fetch,
): Promise<Proposal | null> {
	const res = await fetchImpl(GROQ_URL, {
		method: "POST",
		headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		body: JSON.stringify(groqProposalRequest(model, prompt)),
		signal: AbortSignal.timeout(60_000),
	});
	if (!res.ok) {
		// The status and the API's own first line; never the key, never the prompt (AGENTS.md, Security).
		let detail = "";
		try {
			const body = (await res.json()) as { error?: { message?: string } };
			detail = String(body.error?.message ?? "").split("\n")[0] ?? "";
		} catch {
			// Not JSON; the status is enough.
		}
		throw new Error(`groq ${res.status}${detail ? `: ${detail}` : ""}`);
	}
	return parseProposalAnswer(await res.json());
}
