# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning cadence, while pre-1.0:

- **Work on a branch adds its entry under `Unreleased`, with no version number.**
  A branch cannot know what number is free: two branches open at once both reach
  for the same one, and only whichever merges first is right.
- **The number is assigned when the branch merges to `main`**: the `Unreleased`
  entries become a released section, and the root `package.json` moves to match
  in the same commit.
- **Patch** (`0.x.y`) for ordinary work, **minor** (`0.x.0`) when a phase of
  [the work plan](./spec/definicion/07_plan-de-trabajo.md) closes.
- `package.json` always matches the topmost released version here.

Two things this project's entries carry that a web app's would not:

- **Anything that happened on Sepolia comes with its transaction hash** — a
  deployment, a `ship`, a fill, a `createPosition`, a `revokeRoles`. The chain is
  the evidence; the hash is how a reader finds it.
- **A closed risk is news.** When one of the risks in the plan is resolved either
  way (the direction gate holds, or it does not and plan B is in), the entry says
  so, with the date, because the definition documents were rewritten on it.

## [Unreleased]

### Added

- **Sepolia tooling for phase 0, verified as far as it can be without the
  holder's wallet.** `script/Deploy.s.sol` redeploys official Aqua and
  `AquaSwapVMRouter` plus `TestWETH`, `tWBTC` (8 dec) and `tUSDC` (6 dec),
  writes `deployments/<chainId>.json`, and `scripts/write-addresses.mjs`
  turns that into the `moorSepolia` block of `packages/core/src/addresses.ts`
  — proven end to end against Anvil (`contracts:deploy:anvil`; `router.AQUA()`
  matches). The Sepolia run itself waits on `SEPOLIA_RPC_URL`,
  `DEPLOYER_PRIVATE_KEY` and faucet ETH.

  `packages/erc7730/descriptors/calldata-Aqua.json` — the ERC-7730 descriptor
  for `ship`/`dock`, generated from the compiled ABI and clean under
  `erc7730 lint` (device limits: owner ≤ 22, URL ≤ 26). Address is the zero
  placeholder until deploy.

  `pnpm ledger:emu` starts Speculos with the **prebuilt** Ethereum app
  (`LedgerHQ/app-ethereum` 1.22.3 ships an ELF per device — no build), and
  checks for `qemu-user-static` first, which is the one system package pip
  cannot install. `@ledgerhq/wallet-cli` 2.1.0 installed; `ring init` needs
  the device. Three Ledger findings (prebuilt ELFs, the qemu dependency, the
  undocumented headless Key Ring enrolment) are in `spec/feedback/`.

- **Phase 0 scaffolding: the monorepo exists and every check is green.**
  pnpm workspaces with `apps/live-app` (Next.js 16, empty page wired for
  Sepolia, Wallet API deps declared), `apps/agent` (env validation, a cycle
  that does nothing yet), `packages/core` (the one implementation of a
  position: `PositionParams`, `deriveState()`, record schemas, ENSv2 Sepolia
  addresses — 20 tests, 100% coverage against the 90% floor),
  `packages/erc7730` (descriptor layout, `ledger:emu`/`ledger:screens`
  placeholders) and `packages/contracts` (Foundry). Biome, `.nvmrc`,
  `.githooks` (pre-commit lint/fmt, pre-push refuses `main`), and a PR-only
  GitHub Actions workflow with a TypeScript job and a Foundry job.

  **SwapVM, Aqua and ENSv2 compile together under one toolchain** — solc
  0.8.30, via-IR, cancun, the settings they pin — proven by
  `test/Deps.t.sol`. Getting there took two decisions worth recording:
  SwapVM and Aqua resolve dependencies through `node_modules` and their npm
  packages are not published, so OpenZeppelin 5.4.0 and `@1inch/solidity-utils`
  6.9.10 come in as submodules; and Foundry's resolver ignores solc context
  remappings, so ENSv2's own OpenZeppelin 5.3.0 cannot be scoped to its tree
  — everything builds against 5.4.0, which is source-compatible. Both are in
  `spec/feedback/` as the first real entries.

  Dependencies are pinned by tag where the upstream has one (`swap-vm`
  v1.0.2, `aqua` v1.0.0, `openzeppelin-contracts` v5.4.0, `solidity-utils`
  6.9.10, `forge-std` v1.16.2) and by commit where it does not
  (`contracts-v2`).

- **Test coverage floor: 90% on `packages/core`, no blanket number on
  contracts.** `packages/core`'s Vitest coverage thresholds
  (lines/functions/branches/statements) are enforced inside `pnpm test`
  itself — the command fails under the floor, there is no separate
  coverage-check step, the same mechanism as the 80% floor on
  `cuente-conmigo`. Contracts run `forge coverage --report summary` in CI,
  but are held to the three named critical tests (the direction gate, the
  agent's negative roles, `strategyHash` parity) rather than a percentage: a
  small, security-critical contract earns more from exhaustive coverage on
  its decision branches than from hitting a uniform number by testing
  getters. Documented in `AGENTS.md`, `spec/definicion/06_tecnologias.md`
  §6/§9, and the PR template checklist.

### Changed

### Fixed

### Removed
