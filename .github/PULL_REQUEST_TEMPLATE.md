# What this changes

<!-- What the reader gets that they did not have before, and why. Not a list of
files — that is what the diff is for. -->

## How it was verified

<!-- What you ran and what it proved. "Tests pass" says less than "the reverse
swap now reverts with InvalidDirection, verified against the shipped program". -->

## Contracts and chain

<!-- Delete this section if the pull request touches no contract, deployment
script or ERC-7730 descriptor. -->

- [ ] `forge test` passes, including `CoreInvariants` on any changed program
- [ ] If a contract was deployed to Sepolia, `packages/core/src/addresses.ts` was
      updated and the tx hash is in the CHANGELOG entry
- [ ] No canonical 1inch production address was introduced — Sepolia only
- [ ] Every function this PR makes signable ships with its ERC-7730 descriptor
      and its Speculos capture (`pnpm ledger:screens` was re-run)

**Contracts here are not gated by CI on merge.** `contracts:deploy` is run by
hand, against Sepolia only. Review the diff before running it, not after —
`ship`/`dock` and the registrar's roles are what a judge will check with `cast`.

## Checklist

- [ ] Tests were written before the implementation, and failed first
- [ ] `pnpm test` (Vitest) passes, coverage on `packages/core` at 90% or above
- [ ] `forge test` passes
- [ ] `pnpm typecheck` is clean
- [ ] `pnpm check` (Biome) and `forge fmt --check` are clean
- [ ] The agent's negative-role tests still pass: it cannot touch the position,
      the registry, or Aqua — only `setText` on the eight `moor.agent.*` keys
- [ ] No private key, seed, RPC key or Anthropic API key in code, logs or commits
- [ ] `spec/`, `README.md` and `AGENTS.md` are still true after this change
- [ ] `CHANGELOG.md` has the entry, with tx hashes for anything that happened
      on Sepolia

## Anything the reviewer should push back on

<!-- Shortcuts taken, decisions you are unsure about, things left for later.
Silence here reads as "nothing to question", which is rarely true. -->
