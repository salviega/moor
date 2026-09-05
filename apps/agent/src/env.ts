/**
 * Every variable the agent needs, validated at start. Secrets come from Key
 * Ring on the host (AGENTS.md, Security); this only reads the environment the
 * ring populated. If anything is missing, the process does not start.
 */
import { z } from "zod";

const Env = z.object({
	SEPOLIA_RPC_URL: z.string().url(),
	AGENT_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
	ANTHROPIC_API_KEY: z.string().min(1),
	AGENT_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof Env>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
	return Env.parse(source);
}
