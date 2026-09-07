<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/logo-dark.svg">
    <img src="brand/logo.svg" alt="Moor" width="268">
  </picture>
</p>

# Moor

Turns the waiting time of holding into productive capital: a position signed
once from a Ledger that earns fees through 1inch Aqua while the tokens never
leave the wallet, already contains the order that fills when the price
arrives, and has an ENS name anyone can read. An agent watches and proposes;
the Ledger decides.

Built for ETHOnline 2026 — 1inch (Aqua/SwapVM), ENS (ENSv2) and Ledger (AI
Agents) bounties.

**Status:** phases 0–4 done, seven days ahead of the plan — the one-directional
range order runs on Sepolia and passes SwapVM's invariants, names and
permissions are live, the Live App signs from a Ledger, and the agent runs
unattended as a Supabase Edge Function on a five-minute `pg_cron`. Phase 5
(demo, submission) is what's left — see [`spec/`](./spec/README.md) for the full
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
| `salviega.eth` UserRegistry (ENSv2 proxy via VerifiableFactory; root = the Ledger account `0xAA1a…62E1`) | [`0xE924…3922`](https://sepolia.etherscan.io/address/0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922) | [`0x0170490f…`](https://sepolia.etherscan.io/tx/0x0170490fa68a22a8f0222cb8832b67356b5c831a93a2224dd156d06295ed9fa4) |
| `salviega.eth` PermissionedResolver (ENSv2 proxy; root = the Ledger account) | [`0x694A…E1E3`](https://sepolia.etherscan.io/address/0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3) | [`0xf98f21f0…`](https://sepolia.etherscan.io/tx/0xf98f21f04e3dd692d3e80cb0a1466b895c4f9a01638a0bc7f5f644aa73948a80) |

Each position is a non-transferable ENSv2 subname (`btc-dip.salviega.eth`) whose `moor.*` records
describe it. The agent is `agent.salviega.eth` and holds exactly one permission: `ROLE_SET_TEXT` on
the eight `moor.agent.*` keys (`PermissionedResolver.authorizeTextRoles`) — anyone can check it with
`hasRoles`, and the holder revokes it with one signature (`revokeAgent`).

First named position: `btc-dip.salviega.eth` → `moor.strategy = 11155111:0x35a92a7d…`, owner and `addr` = the Ledger account, expiry = the program's deadline, non-transferable — `createPosition` [`0xdb7e1132…`](https://sepolia.etherscan.io/tx/0xdb7e113201bbe1913d8f497d13b327c0b6c12567ae41b3ac6aaa92e902285d2c). Agent identity: `agent.salviega.eth` → `0xf98d…4B32` (`setupAgent` [`0x4a6f7b8c…`](https://sepolia.etherscan.io/tx/0x4a6f7b8cefba42412a66d9c4f364352dd79b45d881fc1a329ed10274820388f4)).

**First position created from the Live App on a Ledger Flex (phase 3):** `btc-dip-2.salviega.eth` — 1,000 tUSDC buying tWBTC between 58k and 62k, maker = the Ledger account, one session of three signatures: `approve` [`0x4c812fe6…`](https://sepolia.etherscan.io/tx/0x4c812fe62bfa3a6bb7ab46035a4942d109a24a53ebad095eac3ceef9721aed35) · `ship` [`0x0ba89ceb…`](https://sepolia.etherscan.io/tx/0x0ba89ceb0fdba27838cba8835d5b4cb2d9c2f89a2496de4b4a188397ea0979c0) · `createPosition` [`0x35f2c11e…`](https://sepolia.etherscan.io/tx/0x35f2c11e0a1721bbe1e9a84bfa54f0c1235ed5f33d63148062b37e0e21074f45).

First live position (phase 1): `0x35a92a7d…` — 1,000 tUSDC buying tWBTC between 58k and 62k USDC/BTC. `ship` [`0xf5bf8022…`](https://sepolia.etherscan.io/tx/0xf5bf8022d92eb2f7442ff783d3f7805e4b8274c1c8e2b00b7150a8ad5dac8355) · fill of 0.01 tWBTC → 605.86 tUSDC [`0xe76cc5cf…`](https://sepolia.etherscan.io/tx/0xe76cc5cf16e51a611c96abe17bff7a79f487273c3de75ecbfb78180dac867501) · the reverse direction reverts with `DeadlineReached(0)`.

**The agent's first live writes (phase 4, 2026-09-07):** deployed to Supabase
as an Edge Function, `pg_cron`'s own first tick fired it unattended and
succeeded. Two cycles wrote `moor.agent.*` on `btc-dip`, `btc-dip-2` and
`one-sig-1` — all `farFromRange`, proposing `widen` —
[`0xc87ef116…`](https://sepolia.etherscan.io/tx/0xc87ef116de7a4192f25d4282d4ec859f37a385c98a5c528b52e022d9f15fc48)
and
[`0x62d47922…`](https://sepolia.etherscan.io/tx/0x62d4792283e2fff1eb8e7a3d50058240bb97999bfe9bce458c6fd518ed4fc51).

## Documentation

- [`spec/README.md`](./spec/README.md) — start here
- [`spec/definicion/`](./spec/definicion/) — problem, solution, bounties, design, architecture, tech stack, plan, roadmap (in Spanish)
- [`spec/feedback/`](./spec/feedback/) — live feedback log on 1inch, ENS and Ledger docs/SDKs (in Spanish)
- [`AGENTS.md`](./AGENTS.md) — repository rules: commit ritual, security, stack conventions

This top-level README will grow into the public, judge-facing write-up in the
last phase of the plan; today it's a pointer into `spec/`.
