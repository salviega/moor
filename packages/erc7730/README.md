# @moor/erc7730

One descriptor per contract the holder signs against (AGENTS.md, ritual step 4):

| Descriptor | Functions | Status |
| --- | --- | --- |
| `descriptors/aqua.json` | `ship`, `dock` | phase 0 — the contract already exists |
| `descriptors/moor-registrar.json` | `createPosition` | phase 2, with the contract |
| `descriptors/permissioned-registry.json` | `revokeRoles` | phase 2 |
| `descriptors/permissioned-resolver.json` | `revokeRoles` | phase 2 |

`screens/` holds what Speculos renders for each of those calls. `pnpm ledger:screens`
regenerates them; CI diffs them, so a descriptor change that alters a screen fails
the build, not the demo.

Speculos is not a wallet. Its seed is a test seed and nothing of value touches it.
