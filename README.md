# Moor

Turns the waiting time of holding into productive capital: a position signed
once from a Ledger that earns fees through 1inch Aqua while the tokens never
leave the wallet, already contains the order that fills when the price
arrives, and has an ENS name anyone can read. An agent watches and proposes;
the Ledger decides.

Built for ETHOnline 2026 — 1inch (Aqua/SwapVM), ENS (ENSv2) and Ledger (AI
Agents) bounties.

**Status:** phases 0 and 1 done — the one-directional range order runs on Sepolia and passes SwapVM's invariants; phase 2 (ENSv2 names and permissions) built, tested and deployed, waiting for the holder's Ledger signature — see [`spec/`](./spec/README.md) for the full
specification and [`spec/definicion/07_plan-de-trabajo.md`](./spec/definicion/07_plan-de-trabajo.md)
for the phased plan and current progress.

## Sepolia deployments (phase 0, 2026-09-05)

Official, unmodified 1inch contracts redeployed for the hackathon — the canonical
production addresses do not exist on Sepolia. Source of truth: `packages/core/src/addresses.ts`.

| Contract | Address | Deploy tx |
| --- | --- | --- |
| Aqua (Sourcify `exact_match`) | [`0xB874…7140`](https://sepolia.etherscan.io/address/0xB8747B3e2F90154420165FB2fc4707D638797140) | [`0x66beea8d…`](https://sepolia.etherscan.io/tx/0x66beea8da42bf781827d09e035d32178763635b34a69dc38e61b6f79988808aa) |
| AquaSwapVMRouter | [`0xdD02…04Cd`](https://sepolia.etherscan.io/address/0xdD026eA05C9256A1162dC3d41102579458A804Cd) | [`0x039c3354…`](https://sepolia.etherscan.io/tx/0x039c3354bc524c26c15006de99517ca7f38d3718fe672717d8c14d91e458f1a2) |
| TestWETH | [`0x10C5…dfA0`](https://sepolia.etherscan.io/address/0x10C5026152eB4f79119d6cFb75205aEB6E98dfA0) | [`0x51c04d41…`](https://sepolia.etherscan.io/tx/0x51c04d41a7d8ce3486c135b626ea36d54528bf0381315638ac8ce81048d06232) |
| tWBTC (8 dec, open mint — demo only) | [`0xfA92…7deC`](https://sepolia.etherscan.io/address/0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC) | [`0x69b6c4c1…`](https://sepolia.etherscan.io/tx/0x69b6c4c16ba6adc55cf697857e6cc23ae9ef32681f07f3c16579b6a25af27ced) |
| tUSDC (6 dec, open mint — demo only) | [`0x274a…57AB`](https://sepolia.etherscan.io/address/0x274aaB610937e018310cCedC0b05B543b75557AB) | [`0x09d4e09f…`](https://sepolia.etherscan.io/tx/0x09d4e09fc4ccae6ec374a35a497e2089df33a86615f323adbb6a00b668492537) |

Live App (empty, phase 0): [getmoor.vercel.app](https://getmoor.vercel.app) · ENS parent: `salviega.eth` on ENSv2 Sepolia.

## Names and permissions (phase 2, 2026-09-05)

| Contract | Address | Deploy tx |
| --- | --- | --- |
| MoorRegistrar (Sourcify `exact_match`) | [`0xe691…9966`](https://sepolia.etherscan.io/address/0xe6915D2E5e8Db86661a66472e5B178d0dB419966) | [`0x4de2af32…`](https://sepolia.etherscan.io/tx/0x4de2af32609b80e9d51fd03009ceb59543c2c197e6cf69e71b3bb44e62b14de2) |
| `salviega.eth` UserRegistry (ENSv2 proxy via VerifiableFactory) | [`0x6b1D…9E81`](https://sepolia.etherscan.io/address/0x6b1D890908f8cDEEF618dC3c278a76Bf28cf9E81) | [`0x1cc1326a…`](https://sepolia.etherscan.io/tx/0x1cc1326ac4d04141a7759e0d341f1505f66f824f319d34866d2dd4e089f85941) |

Each position is a non-transferable ENSv2 subname (`btc-dip.salviega.eth`) whose `moor.*` records
describe it. The agent is `agent.salviega.eth` and holds exactly one permission: `ROLE_SET_TEXT` on
the eight `moor.agent.*` keys (`PermissionedResolver.authorizeTextRoles`) — anyone can check it with
`hasRoles`, and the holder revokes it with one signature (`revokeAgent`).

First live position (phase 1): `0x35a92a7d…` — 1,000 tUSDC buying tWBTC between 58k and 62k USDC/BTC. `ship` [`0xf5bf8022…`](https://sepolia.etherscan.io/tx/0xf5bf8022d92eb2f7442ff783d3f7805e4b8274c1c8e2b00b7150a8ad5dac8355) · fill of 0.01 tWBTC → 605.86 tUSDC [`0xe76cc5cf…`](https://sepolia.etherscan.io/tx/0xe76cc5cf16e51a611c96abe17bff7a79f487273c3de75ecbfb78180dac867501) · the reverse direction reverts with `DeadlineReached(0)`.

## Documentation

- [`spec/README.md`](./spec/README.md) — start here
- [`spec/definicion/`](./spec/definicion/) — problem, solution, bounties, design, architecture, tech stack, plan, roadmap (in Spanish)
- [`spec/feedback/`](./spec/feedback/) — live feedback log on 1inch, ENS and Ledger docs/SDKs (in Spanish)
- [`AGENTS.md`](./AGENTS.md) — repository rules: commit ritual, security, stack conventions

This top-level README will grow into the public, judge-facing write-up in the
last phase of the plan; today it's a pointer into `spec/`.
