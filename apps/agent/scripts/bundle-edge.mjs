// Bundles the agent's Edge Function (src/edge.ts) into one ESM file Deno can run
// on Supabase: @moor/core, viem and zod go inside, so the function needs no
// import map and no network at cold start. Output is git-ignored and rebuilt by
// `pnpm agent:bundle` before every `agent:serve` / `agent:deploy`.
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(here, "../../../supabase/functions/agent-cycle/index.js");
await mkdir(dirname(outfile), { recursive: true });

const result = await build({
	entryPoints: [resolve(here, "../src/edge.ts")],
	outfile,
	bundle: true,
	format: "esm",
	platform: "neutral",
	target: "esnext",
	mainFields: ["module", "main"],
	conditions: ["import", "default"],
	// viem's WebSocket transport imports `ws` (Node-only); the agent only ever uses HTTP.
	alias: { ws: resolve(here, "stubs/ws.js") },
	legalComments: "none",
	banner: {
		js: "// Built by `pnpm agent:bundle` from apps/agent/src/edge.ts — do not edit; edit the source.",
	},
	metafile: true,
	logLevel: "warning",
});
const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`agent-cycle: ${(bytes / 1024).toFixed(0)} KB → ${outfile}`);
