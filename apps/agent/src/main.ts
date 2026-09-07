/**
 * The agent under Node: the loop for a machine that runs it directly
 * (`pnpm agent:loop`), or one cycle and out (`pnpm agent`). The cycle itself is
 * `cycle.ts`, shared with the Supabase Edge Function in `edge.ts` — the one that
 * actually runs in production (05 §8).
 */
import pino from "pino";
import { type Log, makeClients, runCycle } from "./cycle";
import { loadEnv } from "./env";

const pinoLog = pino({ name: "moor-agent" });
const log: Log = {
	info: (fields, msg) => pinoLog.info(fields, msg),
	warn: (fields, msg) => pinoLog.warn(fields, msg),
};
const once = process.argv.includes("--once");
const env = loadEnv(process.env);
const clients = makeClients(env);

async function main(): Promise<void> {
	pinoLog.info(
		{
			agent: clients.account.address,
			parent: env.AGENT_PARENT_NAME,
			intervalSeconds: env.AGENT_INTERVAL_SECONDS,
			model: env.GROQ_API_KEY ? env.AGENT_MODEL : "none (deterministic)",
			once,
			dryRun: env.AGENT_DRY_RUN,
		},
		"agent starting",
	);
	await runCycle(env, clients, log);
	if (once) return;
	setInterval(() => {
		runCycle(env, clients, log).catch((err) =>
			pinoLog.error({ err }, "cycle failed; the position keeps working"),
		);
	}, env.AGENT_INTERVAL_SECONDS * 1_000);
}

main().catch((err) => {
	pinoLog.fatal({ err }, "agent could not start");
	process.exit(1);
});
