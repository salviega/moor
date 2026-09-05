# @moor/erc7730

One descriptor per contract the holder signs against (AGENTS.md, ritual step 4),
and the Speculos captures that prove what the device shows.

| Descriptor | Functions | Status |
| --- | --- | --- |
| `descriptors/calldata-Aqua.json` | `ship`, `dock` | lints clean; real Aqua address, ABI validated against Sourcify |
| `descriptors/calldata-MoorRegistrar.json` | `createPosition`, `setupAgent`, `revokeAgent` | lints clean; `0xe691…9966`, ABI validated against Sourcify (`exact_match`) |
| `descriptors/calldata-PermissionedRegistry.json` | `setSubregistry`, `grantRootRoles`, `revokeRootRoles`, `grantRoles`, `revokeRoles`, `unregister` | ETHRegistry + the holder's registry; lint warns only that the ENS proxies are not on Sourcify |
| `descriptors/calldata-PermissionedResolver.json` | `grantRootRoles`, `revokeRootRoles`, `authorizeTextRoles` | the holder's resolver; same warning |

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
public registry after a merge. Ledger's [ERC-7730 Tester](https://app.devicesdk.ledger.com/clear-signing-tools)
"injects your descriptor and displays the resulting fields against a live Ledger
signer or the Speculos emulator" — that is how a local descriptor gets previewed
before the registry PR. How it gets past the PKI check, and whether it can be
driven from CI, is the open question in `spec/feedback/03_ledger.md`; until it is
answered, `ledger:screens` stays a placeholder (phase 3).

`screens/phase0-ethereum-app-1.22.3-home-flex.png` is the phase-0 evidence that
Speculos runs the prebuilt app: Flex, Ethereum 1.22.3, seed address
`0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D`.

Speculos is not a wallet. Its seed is the public test mnemonic from Speculos'
own documentation and nothing of value ever touches it.
