/**
 * The one call per proposal (06 §5): Claude Opus 5 chooses between the
 * alternatives core already simulated and explains. Structured output parsed
 * against the shared Proposal schema; server-side fallbacks so a classifier
 * refusal does not leave a cycle without a proposal; adaptive thinking.
 * Anything that does not validate is not written — the caller falls back to the
 * deterministic proposal.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Proposal } from "@moor/core";

export async function proposeWithClaude(
	client: Anthropic,
	model: string,
	prompt: { system: string; user: string },
): Promise<Proposal | null> {
	const message = await client.beta.messages.parse({
		model,
		max_tokens: 2048,
		betas: ["structured-outputs-2025-11-13", "server-side-fallback-2026-07-01"],
		fallbacks: "default",
		thinking: { type: "adaptive" },
		system: prompt.system,
		messages: [{ role: "user", content: prompt.user }],
		output_config: { format: betaZodOutputFormat(Proposal) },
	});
	if (message.stop_reason === "refusal" || !message.parsed_output) return null;
	const parsed = Proposal.safeParse(message.parsed_output);
	return parsed.success ? parsed.data : null;
}
