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

On the VPS the secrets come from Ledger Key Ring, never from a file:
`deploy/run.sh` decrypts them with `wallet-cli ring` at start and `deploy/moor-agent.service`
keeps the loop alive under systemd.
