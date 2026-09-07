/**
 * Every variable the agent needs, validated at start. Secrets come from Key
 * Ring on the host (AGENTS.md, Security); this only reads the environment the
 * ring populated. If anything is missing, the process does not start.
 */
import { z } from "zod";

const Env = z.object({
	SEPOLIA_RPC_URL: z.url(),
	AGENT_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
	/** Without it the agent still runs: proposals are the deterministic ones (07, the cut allows). Groq's free tier covers one call per proposal. */
	GROQ_API_KEY: z.string().min(1).optional(),
	/** A Groq model with strict structured outputs (06 §5). */
	AGENT_MODEL: z.string().default("openai/gpt-oss-120b"),
	AGENT_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
	/** The holder's name; positions are its subnames. */
	AGENT_PARENT_NAME: z
		.string()
		.regex(/^[a-z0-9-]+\.eth$/)
		.default("salviega.eth"),
	/** eth_getLogs range per request; public RPCs allow ~10k, some free tiers only 10. */
	AGENT_LOGS_CHUNK: z.coerce.number().int().positive().default(10_000),
	AGENT_FROM_BLOCK: z.coerce.bigint().default(11_600_000n),
	/** Ask again even when a proposal for the same trigger is standing (a test knob; the loop never needs it). */
	AGENT_FORCE_PROPOSE: z
		.string()
		.optional()
		.transform((v) => v === "1" || v === "true"),
	/** Read, derive, log — but send nothing. */
	AGENT_DRY_RUN: z
		.string()
		.optional()
		.transform((v) => v === "1" || v === "true"),
});

export type Env = z.infer<typeof Env>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
	return Env.parse(source);
}
