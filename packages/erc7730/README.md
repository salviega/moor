# @moor/erc7730

One descriptor per contract the holder signs against (AGENTS.md, ritual step 4),
and the Speculos captures that prove what the device shows.

| Descriptor | Functions | Status |
| --- | --- | --- |
| `descriptors/calldata-Aqua.json` | `ship`, `dock` | lints clean; real Aqua address, ABI validated against Sourcify |
| `descriptors/calldata-MoorRegistrar.json` | `createPosition`, `setupAgent`, `revokeAgent` | lints clean; `0xe691…9966`, ABI validated against Sourcify (`exact_match`) |
| `descriptors/calldata-PermissionedRegistry.json` | `setSubregistry`, `grantRootRoles`, `revokeRootRoles`, `grantRoles`, `revokeRoles`, `unregister` | ETHRegistry + the holder's registry; lint warns only that the ENS proxies are not on Sourcify |
| `descriptors/calldata-PermissionedResolver.json` | `grantRootRoles`, `revokeRootRoles`, `authorizeTextRoles` | the holder's resolver `0x694A…E1E3`; same warning |

`approve` is the standard ERC-20 descriptor Ledger already ships; no file here.

## Setup

```sh
python3 -m venv .venv && .venv/bin/pip install speculos erc7730   # from the repo root
sudo apt install -y qemu-user-static                              # Speculos runs the app under qemu-arm
```

## Commands

```sh
pnpm ledger:emu                     # Speculos, flex, Ethereum app 1.22.3 (prebuilt ELF from LedgerHQ/app-ethereum), API :5001
pnpm ledger:emu -- --model nanox
.venv/bin/erc7730 lint packages/erc7730/descriptors/calldata-Aqua.json
pnpm ledger:screens                 # renders the six signatures on an emulated Flex (Docker, Node 24)
```

Device limits enforced by `erc7730 lint`: owner ≤ 22 chars, URL ≤ 26 chars. ABI
validation against Sourcify/Etherscan only works once the contract is deployed and
verified — until then the linter warns and moves on.

## What the device can and cannot show

`pnpm ledger:screens` renders the six signatures of the flow on an emulated Ledger Flex
with these descriptors injected, using Ledger's own clear-signing tester
(`apps/clear-signing-tester` in `LedgerHQ/device-sdk-ts`, cloned into `.cs-tester/` and
built on first run, commit pinned in `scripts/screens.mjs`). Its CAL interceptor serves
our **unsigned** descriptors to the Ethereum app in place of Ledger's production CAL, so
no registry PR is needed to see the screens. Requirements: Docker (Speculos runs in a
container), Node 24 (`nvm use 24`), `gh` (downloads the prebuilt app ELF).

| Signature | Result | Screens |
| --- | --- | --- |
| `approve` (ERC-20, Ledger's own screen) | blind-signed — the testnet token is not in Ledger's CAL | `screens/approve/` |
| `ship` → "Open Moor position" | clear-signed | `screens/ship/` |
| `createPosition` → "Name Moor position" | clear-signed | `screens/createPosition/` |
| `dock` → "Close Moor position" | clear-signed | `screens/dock/` |
| `unregister` → "Remove position name" | clear-signed | `screens/unregister/` |
| `revokeAgent` → "Revoke Moor agent" | clear-signed | `screens/revokeAgent/` |

`screens/results.json` carries the verdicts; the `ledger-screens` workflow (manual,
`workflow_dispatch` — it takes ~8 minutes) regenerates the folder and runs `scripts/screens-check.mjs`: the verdict of every
signature and every frame the holder reads before "Hold to sign" must be unchanged. The last
two frames of a flow (the device's post-signature transition) and `approve/` (Ledger's own
ERC-20 flow) depend on timing, so they are kept as evidence but not compared. The transactions come from `@moor/core`'s `demoFlow()` —
the same builders the Live App signs with — via `scripts/raw-flow.ts`.

**The physical device is a different story.** Ledger Live only clear-signs descriptors
published in Ledger's registry; a local descriptor cannot be loaded, so the Flex
blind-signs the demo until the registry PR lands. The Live App says on every step what a
Ledger with the published descriptor would show ("Ledger shows: …").

## Probe: a whole session in one signature (EIP-7702)

A holder whose account is delegated with EIP-7702 to `Simple7702Account` (the one 7702
delegate the Ledger Ethereum app whitelists) signs a multi-call session as **one**
`executeBatch` to their own address (`sessionCalls` in `@moor/core`; the opt-in is made on
chain from `apps/probe-7702`). Its descriptor is `descriptors/calldata-Simple7702Account.json`:
`calls.[].data` uses ERC-7730's nested `calldata` format (`calleePath: calls.[].target`), so
each inner call renders with its own descriptor. `pnpm ledger:screens -- --probe` renders
two extra transactions that never touch the flow's captures or `results.json` (verdicts in
`screens/results-probe.json`), both carrying `ship` + `createPosition` inside one batch:

| Probe | `to` | Result | Screens |
| --- | --- | --- | --- |
| `batch7702Blind` | the holder's own address (the real 7702 shape) | blind-signed — no descriptor can be bound to an EOA; the device refuses until blind signing is on | `screens/batch7702Blind/` |
| `batch7702BlindSigning` | same, with the device's blind-signing setting on (`--blind-signing-enabled`) — what a physical Flex shows today | "Blind signing ahead" → "Review transaction · Blind signing required" → From / To / Max fees → Network · Transaction hash → "Accept risk and sign transaction?"; the tester calls it *partially clear-signed* (network and fees render), a person reads it as blind end to end | `screens/batch7702BlindSigning/` |
| `batch7702Nested` | `Simple7702Account` itself | the app enumerates **"Review transaction 1 of 2 / 2 of 2"** and renders each inner call with *our* `ship` and `createPosition` descriptors — every frame in the product's words; the tester's verdict is *partially clear-signed* (the `???` token amount, as in `ship` alone) | `screens/batch7702Nested/` |

What Speculos proves: app 1.22.3 + these descriptors render nested calls. What the physical
device showed (2026-09-06): blind — Ledger's servers had no descriptor for `Simple7702Account`
on any network, nor for ours (`pnpm --filter @moor/probe-7702 cal`). Hence the registry
pull requests, in the registry's v2 schema with `testsv2/` fixtures built from `demoFlow()`:
[#2953](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2953) (Moor) and
[#2954](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2954)
(`Simple7702Account`). Whether Ledger then resolves the delegate's descriptor when `to` is a
delegated EOA (`ProxyContextFieldLoader`, server-side, PKI-signed) is the last open question,
and it is Ledger's.

`screens/phase0-ethereum-app-1.22.3-home-flex.png` is the phase-0 evidence that
Speculos runs the prebuilt app: Flex, Ethereum 1.22.3, seed address
`0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D`.

Speculos is not a wallet. Its seed is the public test mnemonic from Speculos'
own documentation and nothing of value ever touches it.
