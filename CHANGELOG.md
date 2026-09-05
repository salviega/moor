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
