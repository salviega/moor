# agent-cycle

The Moor agent as a Supabase Edge Function: one cycle per request (05 §8). The
source is `apps/agent/src/edge.ts` → `cycle.ts`; `pnpm agent:bundle` builds
`index.js` here (git-ignored) with `@moor/core`, viem and zod inside.

| Command | What it does |
| --- | --- |
| `pnpm agent:serve` | Bundles and runs the function under Deno with the root `.env` (port 8000); then `curl "http://localhost:8000/?dry=1"`. `npx supabase functions serve` is the full-fidelity path and needs `npx supabase start` (Docker) first |
| `pnpm agent:secrets` | Pushes the agent's variables — only those — from `.env` to the linked project |
| `pnpm agent:deploy` | Bundles and deploys; needs `npx supabase login` and `npx supabase link` once |
| `npx supabase db push` | Applies `migrations/…_agent_cron.sql`: pg_cron every 5 min, after the two Vault secrets exist |

`?dry=1` reads, derives and answers without sending a transaction.
