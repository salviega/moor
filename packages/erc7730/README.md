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
`workflow_dispatch` — it takes ~8 minutes) regenerates the folder and fails on any diff in
the five descriptor-covered signatures (`approve/` is Ledger's own flow and its screens
depend on timing, so they are kept as evidence but not diffed). The transactions come from `@moor/core`'s `demoFlow()` —
the same builders the Live App signs with — via `scripts/raw-flow.ts`.

**The physical device is a different story.** Ledger Live only clear-signs descriptors
published in Ledger's registry; a local descriptor cannot be loaded, so the Flex
blind-signs the demo until the registry PR lands. The Live App says on every step what a
Ledger with the published descriptor would show ("Ledger shows: …").

`screens/phase0-ethereum-app-1.22.3-home-flex.png` is the phase-0 evidence that
Speculos runs the prebuilt app: Flex, Ethereum 1.22.3, seed address
`0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D`.

Speculos is not a wallet. Its seed is the public test mnemonic from Speculos'
own documentation and nothing of value ever touches it.
