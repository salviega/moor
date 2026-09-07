# @moor/agent

The headless watcher (04 §4.4). Every 300 s it starts from the chain — the holder's
registry and resolver, the position names, Aqua balances, the Chainlink price —
derives with `@moor/core`, and writes the eight `moor.agent.*` records of each
position through **one** `multicall` of `setText` on the holder's resolver. That is
the whole of what its key can do: `ROLE_SET_TEXT` on those eight keys, granted per key
(`PermissionedResolver.authorizeTextRoles`), nothing on the registry, nothing on Aqua.
The negative-role tests in `packages/contracts/test/MoorRegistrar.t.sol` are what say so.

When a threshold crosses (`THRESHOLDS` in `packages/core/src/agent.ts`) it simulates
the alternatives in code and asks the model once — Groq's OpenAI-compatible endpoint
over plain `fetch`, `openai/gpt-oss-120b`, strict JSON Schema mode against the shared
`Proposal` schema (`packages/core/src/model.ts` derives the schema and parses the
answer through Zod). An answer that does not validate is never written: the
deterministic proposal is. Without `GROQ_API_KEY` the agent runs on the deterministic
proposals only (the cut 07 allows). Groq's free tier — 30 requests a minute, 1,000 a
day, no card — covers one call per proposal many times over.

```sh
AGENT_DRY_RUN=1 pnpm agent        # one cycle, read and log, send nothing
pnpm agent                        # one cycle, writes
pnpm agent:loop                   # the loop, as on the VPS
```

Environment (06 §8): `SEPOLIA_RPC_URL` (must allow wide `eth_getLogs` ranges —
PublicNode does; Alchemy's free tier does not), `AGENT_PRIVATE_KEY`, optional
`GROQ_API_KEY`, `AGENT_INTERVAL_SECONDS`, `AGENT_PARENT_NAME`, `AGENT_MODEL`,
`AGENT_LOGS_CHUNK`, `AGENT_FROM_BLOCK`, `AGENT_DRY_RUN`.

In production the agent is a **Supabase Edge Function**: `src/edge.ts` runs one
cycle per request (`src/cycle.ts` is the cycle, shared with the Node entry
`src/main.ts`), and `pg_cron` calls it every five minutes
(`supabase/migrations/…_agent_cron.sql`). Secrets are project secrets, never a
file in this repository.

```sh
pnpm agent:bundle                 # esbuild: src/edge.ts + @moor/core + viem + zod → supabase/functions/agent-cycle/index.js
pnpm agent:serve                  # the same bundle under Deno with .env; curl 'localhost:8000/?dry=1' runs a cycle without sending
npx supabase login && npx supabase link --project-ref <ref>   # once, by the holder
pnpm agent:secrets                # pushes SEPOLIA_RPC_URL, AGENT_PRIVATE_KEY, GROQ_API_KEY, AGENT_* from .env — only those
pnpm agent:deploy                 # bundle + `supabase functions deploy agent-cycle`
npx supabase db push              # the cron, after `vault.create_secret` for project_url and anon_key (see the migration)
```

`?dry=1` on the deployed URL runs a cycle without sending — the way to check a
deployment before trusting it with gas. The RPC must allow wide `eth_getLogs`
ranges (PublicNode does; Alchemy's free tier answers "JSON is not a valid
request object" through viem — that is the 10-block cap, not malformed JSON).

Ledger Key Ring on a host of our own was the first plan (`deploy/run.sh` +
systemd, retired on 2026-09-06 — in the history); it returns when enrolling a
host without USB is documented ([`08_roadmap.md`](../../spec/definicion/08_roadmap.md)).
