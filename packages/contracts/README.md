# @moor/contracts

Foundry project. Sepolia only during the hackathon (spec 05 §1).

| Path | What |
| --- | --- |
| `src/` | `MoorRegistrar`, `MoorProgramFactory` — the two Moor contracts (05 §2). Nothing here is ever the Aqua maker or holds a token approval. |
| `test/` | Named critical tests (AGENTS.md, *Tests come first*) plus `Deps.t.sol`, the phase-0 proof that SwapVM, Aqua and ENSv2 compile together. |
| `script/` | `contracts:deploy` — redeploys official Aqua + SwapVM, test WBTC/USDC, and the Moor contracts to Sepolia; writes addresses for `packages/core`. |
| `lib/` | Git submodules, pinned: `swap-vm` v1.0.2, `aqua` v1.0.0, `openzeppelin-contracts` v5.4.0, `solidity-utils` 6.9.10, `forge-std` v1.16.2, `contracts-v2` (ENSv2, no release tags — pinned by commit in `.gitmodules`). |
| `deployments/` | Broadcast output that `contracts:deploy` turns into `packages/core/src/addresses.ts`. |

## Toolchain notes

- **solc 0.8.30, via-IR, evm cancun** — what SwapVM, Aqua and ENSv2 pin. Redeployed bytecode is theirs, not a recompile with different settings.
- **SwapVM and Aqua resolve dependencies through `node_modules`** (hybrid Hardhat/Foundry repos, and their npm packages are not actually published). We provide the same packages as submodules and remap them in `foundry.toml`.
- **One OpenZeppelin for everybody (5.4.0).** Foundry's resolver does not honour solc context remappings, so ENSv2's own 5.3.0 cannot be scoped to its tree; the two are source-compatible.
- **`forge coverage` needs `--ir-minimum`** under via-IR, or it fails to compile the instrumented build.

```sh
pnpm contracts:build      # forge build
pnpm contracts:test       # forge test
pnpm contracts:coverage   # forge coverage --report summary --ir-minimum (read, not gated)
pnpm contracts:fmt        # forge fmt --check
```
