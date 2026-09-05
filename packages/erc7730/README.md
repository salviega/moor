# @moor/erc7730

One descriptor per contract the holder signs against (AGENTS.md, ritual step 4),
and the Speculos captures that prove what the device shows.

| Descriptor | Functions | Status |
| --- | --- | --- |
| `descriptors/calldata-Aqua.json` | `ship`, `dock` | written; lints clean; Sepolia address is the zero placeholder until `contracts:deploy` |
| `descriptors/calldata-MoorRegistrar.json` | `createPosition` | phase 2, with the contract |
| `descriptors/calldata-PermissionedRegistry.json` | `revokeRoles` | phase 2 |
| `descriptors/calldata-PermissionedResolver.json` | `revokeRoles` | phase 2 |

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
pnpm ledger:screens                 # phase 3
```

Device limits enforced by `erc7730 lint`: owner ≤ 22 chars, URL ≤ 26 chars. ABI
validation against Sourcify/Etherscan only works once the contract is deployed and
verified — until then the linter warns and moves on.

## What the device can and cannot show

A descriptor served by us is **unsigned**. A production Ledger only clear-signs
descriptors that carry Ledger's PKI signature, which the device gets from the
public registry after a merge. Whether Speculos' Ethereum app accepts a local,
unsigned descriptor is the open question in `spec/feedback/03_ledger.md`; until
it is answered, `ledger:screens` cannot exist.

Speculos is not a wallet. Its seed is the public test mnemonic from Speculos'
own documentation and nothing of value ever touches it.
