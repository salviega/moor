/**
 * The agent on Supabase (05 §8): a Deno Edge Function that runs exactly one
 * cycle per request and answers with what it read and wrote. pg_cron calls it
 * every five minutes (supabase/migrations); nothing here loops, sleeps or
 * remembers. Secrets arrive as environment variables set with
 * `supabase secrets set` — never a file in this repository.
 *
 * `?dry=1` runs the cycle without sending, whatever the environment says:
 * the way to exercise a deployment before trusting it with gas.
 *
 * Bundled by `pnpm agent:bundle` (esbuild) into supabase/functions/agent-cycle,
 * with @moor/core, viem and zod inside; the file is not typechecked by Node's
 * tsconfig — Deno is the runtime, hence the declaration below.
 */
import { type Log, makeClients, runCycle } from "./cycle";
import { loadEnv } from "./env";

declare const Deno: {
	env: { toObject(): Record<string, string> };
	serve(handler: (req: Request) => Promise<Response>): void;
};

const line = (level: "info" | "warn" | "error", fields: Record<string, unknown>, msg: string) =>
	console.log(JSON.stringify({ level, msg, ...fields, at: new Date().toISOString() }));
const log: Log = {
	info: (fields, msg) => line("info", fields, msg),
	warn: (fields, msg) => line("warn", fields, msg),
};

Deno.serve(async (req) => {
	const started = Date.now();
	try {
		const raw = Deno.env.toObject();
		const dry = new URL(req.url).searchParams.get("dry") === "1";
		const env = loadEnv(dry ? { ...raw, AGENT_DRY_RUN: "1" } : raw);
		const clients = makeClients(env);
		const result = await runCycle(env, clients, log);
		return Response.json({
			ok: true,
			agent: clients.account.address,
			parent: env.AGENT_PARENT_NAME,
			dryRun: env.AGENT_DRY_RUN,
			ms: Date.now() - started,
			...result,
		});
	} catch (err) {
		// The message, never a key, never a prompt (AGENTS.md, Security).
		const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
		line("error", { reason, ms: Date.now() - started }, "cycle failed; the position keeps working");
		return Response.json({ ok: false, reason }, { status: 500 });
	}
});
