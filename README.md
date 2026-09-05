# Moor

Turns the waiting time of holding into productive capital: a position signed
once from a Ledger that earns fees through 1inch Aqua while the tokens never
leave the wallet, already contains the order that fills when the price
arrives, and has an ENS name anyone can read. An agent watches and proposes;
the Ledger decides.

Built for ETHOnline 2026 — 1inch (Aqua/SwapVM), ENS (ENSv2) and Ledger (AI
Agents) bounties.

**Status:** phase 0 done (monorepo, Sepolia deployments, Live App on Vercel, first Ledger Live signature); phase 1 next — see [`spec/`](./spec/README.md) for the full
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

## Documentation

- [`spec/README.md`](./spec/README.md) — start here
- [`spec/definicion/`](./spec/definicion/) — problem, solution, bounties, design, architecture, tech stack, plan, roadmap (in Spanish)
- [`spec/feedback/`](./spec/feedback/) — live feedback log on 1inch, ENS and Ledger docs/SDKs (in Spanish)
- [`AGENTS.md`](./AGENTS.md) — repository rules: commit ritual, security, stack conventions

This top-level README will grow into the public, judge-facing write-up in the
last phase of the plan; today it's a pointer into `spec/`.
