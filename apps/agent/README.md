# @moor/agent

The headless watcher (04 §4.4). Every 300 s it starts from the chain — the holder's
registry and resolver, the position names, Aqua balances, the Chainlink price —
derives with `@moor/core`, and writes the eight `moor.agent.*` records of each
position through **one** `multicall` of `setText` on the holder's resolver. That is
the whole of what its key can do: `ROLE_SET_TEXT` on those eight keys, granted per key
(`PermissionedResolver.authorizeTextRoles`), nothing on the registry, nothing on Aqua.
The negative-role tests in `packages/contracts/test/MoorRegistrar.t.sol` are what say so.

When a threshold crosses (`THRESHOLDS` in `packages/core/src/agent.ts`) it simulates
the alternatives in code and asks Claude Opus 5 once — structured output parsed
against the shared `Proposal` schema, server-side fallbacks, adaptive thinking. A
refusal or an answer that does not validate is never written: the deterministic
proposal is. Without `ANTHROPIC_API_KEY` the agent runs on the deterministic
proposals only (the cut 07 allows).

```sh
AGENT_DRY_RUN=1 pnpm agent        # one cycle, read and log, send nothing
pnpm agent                        # one cycle, writes
pnpm agent:loop                   # the loop, as on the VPS
```

Environment (06 §8): `SEPOLIA_RPC_URL` (must allow wide `eth_getLogs` ranges —
PublicNode does; Alchemy's free tier does not), `AGENT_PRIVATE_KEY`, optional
`ANTHROPIC_API_KEY` (and `ANTHROPIC_WORKSPACE_ID` when the key is not workspace-scoped), `AGENT_INTERVAL_SECONDS`, `AGENT_PARENT_NAME`, `AGENT_MODEL`,
`AGENT_LOGS_CHUNK`, `AGENT_FROM_BLOCK`, `AGENT_DRY_RUN`.

On the VPS the secrets come from Ledger Key Ring, never from a file:
`deploy/run.sh` decrypts them with `wallet-cli ring` at start and `deploy/moor-agent.service`
keeps the loop alive under systemd.
