# @moor/contracts

Foundry project. Sepolia only during the hackathon (spec 05 §1).

| Path | What |
| --- | --- |
| `src/` | `MoorProgram` (library + `MoorProgramFactory`): the one-directional range-order program, the Aqua order and its hash (05 §1, §5b). `MoorRegistrar` arrives in phase 2. `mocks/` holds the demo tokens. Nothing here is ever the Aqua maker or holds a token approval. |
| `test/` | `MoorProgram.t.sol` (the direction gate, bought-stays-bought, deadline, dock, golden vectors), `MoorProgramInvariants.t.sol` (SwapVM's `CoreInvariants` harness over the allowed direction), `Deps.t.sol`. |
| `script/` | `Deploy.s.sol` (redeploys official Aqua + SwapVM and the demo tokens), `ShipDemo.s.sol` (ships a test position from the broadcaster's wallet), `DemoTaker.s.sol` (fills it, or shows the reverse direction reverting). |
| `lib/` | Git submodules, pinned: `swap-vm` v1.0.2, `aqua` v1.0.0, `openzeppelin-contracts` v5.4.0, `solidity-utils` 6.9.10, `forge-std` v1.16.2, `contracts-v2` (ENSv2, no release tags — pinned by commit in `.gitmodules`). |
| `deployments/` | `<chainId>.json` from `Deploy.s.sol` (turned into `packages/core/src/addresses.ts`) and `positions/<chainId>-<strategyHash>.json` from `ShipDemo.s.sol`. Anvil's (31337) are ignored; Sepolia's are evidence. |

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
pnpm demo:ship            # ship a test position on Sepolia (MOOR_AMOUNT, MOOR_PRICE_MIN/MAX, MOOR_FEE_BPS, MOOR_DAYS)
MOOR_POSITION=deployments/positions/<file>.json pnpm demo:taker              # fill it (MOOR_AMOUNT_IN)
MOOR_POSITION=deployments/positions/<file>.json MOOR_REVERSE=1 pnpm demo:taker  # show the wrong direction reverting
```

## The program (phase 1)

```
 0  Deadline(uint40)                       7 bytes   past it, nothing executes
 7  JumpIfTokenIn(takerTokenIn, 38)       24 bytes   the allowed direction jumps over the trap
31  Deadline(0)                            7 bytes   any other tokenIn: DeadlineReached(0) — expired at epoch 0
38  FeeFlatIn(feeBps)                      5 bytes   the holder's fee on what the taker brings
43  XYCConcentrateSwap(sqrtMin, sqrtMax)  66 bytes   the range; balances come from Aqua
```

Balances are not in the program: Aqua holds them (`useAquaInsteadOfSignature`). With only the quote
token committed, the curve sits at the top of the range and buys the base token on the way down.
The trap is `Deadline(0)` rather than `Revert` because the official `AquaSwapVMRouter` does not
dispatch the `Revert` opcode (`spec/feedback/01_1inch.md`).
