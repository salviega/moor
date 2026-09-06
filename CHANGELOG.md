# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning cadence, while pre-1.0:

- **Work on a branch adds its entry under `Unreleased`, with no version number.**
  A branch cannot know what number is free: two branches open at once both reach
  for the same one, and only whichever merges first is right.
- **The number is assigned when the branch merges to `main`**: the `Unreleased`
  entries become a released section, and the root `package.json` moves to match
  in the same commit.
- **Patch** (`0.x.y`) for ordinary work, **minor** (`0.x.0`) when a phase of
  [the work plan](./spec/definicion/07_plan-de-trabajo.md) closes.
- `package.json` always matches the topmost released version here.

Two things this project's entries carry that a web app's would not:

- **Anything that happened on Sepolia comes with its transaction hash** — a
  deployment, a `ship`, a fill, a `createPosition`, a `revokeRoles`. The chain is
  the evidence; the hash is how a reader finds it.
- **A closed risk is news.** When one of the risks in the plan is resolved either
  way (the direction gate holds, or it does not and plan B is in), the entry says
  so, with the date, because the definition documents were rewritten on it.

## [Unreleased]

### Added

- **Every address is a link to the block explorer (2026-09-06).** One shared
  `ExplorerLink` in `components/ui.tsx` (dotted underline, opens Sepolia
  Etherscan in a new tab, full address on hover when shortened) replaces every
  plain-text address: the owner and the agent's key on the position panel, the
  owner, registry and both tokens under *Technical details* (the separate
  "owner on etherscan" line is gone — the address itself is the link), each
  call's contract on *Review and sign* and in the signing steps, and the
  registry, resolver and registrar on *Setup*. A judge can follow every one
  without copying anything. `strategyHash` stays text: Etherscan has no page
  for it.
- **A live market chart, with the oracle drawn on it (2026-09-06).** The
  first attempt animated the Chainlink line — a feed that ticks every 20 to 60
  minutes on Sepolia cannot look alive, and the holder said so. Now the
  position panel and the form preview carry a real trading chart:
  `lightweight-charts` (TradingView's open-source library, the one new
  dependency) draws candles from a real venue, trade by trade over a
  WebSocket — Binance first, Coinbase Exchange when Binance is unreachable (it
  geo-blocks whole countries) and the other again if a socket keeps dropping —
  at 1m / 15m / 1h / 1d, with crosshair, zoom and pan, the time axis in the
  holder's local time. The position's range is a band behind the candles (a
  series primitive, `RangeBand`) with its working edge labelled ("buys
  58.0k–62.0k"), and **the scale keeps the band in view by default** — the
  holder asked for exactly that; *Follow price* zooms into the candles and,
  from there, the header says how far the range is ("buys 58.0k–62.0k · 27%
  below") with *Show range* to come back. The form's default range follows the
  asset (58k–62k for BTC, 2.2k–2.4k for ETH) until the holder types their own.
  **Two prices on purpose, each
  labelled**: the venue's live price in the header, and the Chainlink price as
  a dashed *oracle* line with its age — "the price your position reacts to" —
  so "the market crossed but nothing traded" has an answer instead of a
  mystery. Everything the venues send crosses Zod in
  `packages/core/src/market.ts` (`parseBinanceKlines`, `parseCoinbaseCandles`,
  the two tick parsers, `applyTick` folding trades into the current candle
  without rewriting history — 12 tests); `apps/live-app/src/lib/market.ts`
  only moves bytes and reconnects. `chainlinkSepolia.ethUsd`
  (`0x694A…5306`, verified on chain: "ETH / USD", 8 decimals) joins `btcUsd`,
  and `usePrice(asset)` / `usePriceHistory(asset)` read the feed of the
  position's own asset, so an ETH position marks its own oracle. If no venue
  answers, the panel falls back to the Chainlink 48-hour ruler and says so.
  Known gap, deliberately left for its own commit: `deriveState` for an ETH
  position is still fed the BTC oracle by `usePositions`, `usePosition` and
  the agent — no ETH position exists on chain yet.
- **The oracle ruler got a crosshair (2026-09-06).** Kept for the review
  screen and as the no-network fallback: `usePrice` polls every 20 s instead
  of 60, the dot slides to its new spot and rings once on a tick (a no-op
  under `prefers-reduced-motion`), and hovering shows the exact price and time
  at that point.
- **A second demo asset: ETH alongside BTC (2026-09-06).** Opening a position now
  starts with a "Which asset" choice — BTC or ETH — before buy/sell, each with its
  own icon; every unit label and the plain-words preview ("If ETH drops below…")
  follow the choice. `packages/core/src/pairs.ts` adds `ethPair` next to `btcPair`
  and `resolveDemoPair(tokenIn, tokenOut)`, which derives which pair an *existing*
  position actually is from its own on-chain token addresses rather than assuming
  BTC — used by the dashboard rows, the position detail panel and, in
  `apps/agent`, the proposal and simulation calls, so an ETH position is never
  read or written as if it were BTC. `moorSepolia.testWeth` (already deployed,
  WETH9-style: `deposit()`/`withdraw()` against real ETH, not open-mint like the
  other test tokens) is now in `addresses.ts`. Real sponsor and coin logos
  (`apps/live-app/public/sponsor-1inch.png`, `sponsor-ens.png`,
  `sponsor-ledger.png`, `token-btc.png`, `token-eth.png`, `token-usdc.png`)
  replace the landing page's text-only sponsor wordmarks and appear next to every
  amount in the rows, the detail panel and the form. Opening a position in ETH
  shows the holder's real (possibly zero) tWETH balance; there is no in-app wrap
  flow yet — funding tWETH happens outside Moor, same as any other test token,
  until a wrap step is asked for.
- **Landing screen when disconnected (2026-09-06).** Choosing an account was
  the only thing the disconnected dashboard asked for, buried in an empty
  positions list. Replaced with `src/components/landing.tsx`: the pitch, a
  pulsing "Connect Ledger account" call to action (host-aware: "Open Moor from
  Ledger Live" when opened outside it), three steps (sign once → the order is
  already working → named, watched, yours to decide) and what each sponsor's
  own tech is doing — 1inch Aqua/SwapVM hold the order and the balance, ENSv2
  names every position with on-chain per-key permissions, Ledger's Wallet API
  and Key Ring sign and hold the agent's one key. Fits one screen on the
  dashboard's own flex-height chain, no page scroll on a normal desktop
  window; a short entrance animation and the CTA's pulse respect
  `prefers-reduced-motion`.
- **A real height chain, no more scrollbar (2026-09-06).** The previous fit
  guessed the nav's height in a `calc()`; on the holder's screen it was off by
  a few pixels and the page still scrolled. Rebuilt on flexbox instead of a
  guess: `body` is `h-dvh` and the only scroll container, `nav` does not
  shrink, `main` is the one `flex-1` region — the dashboard grid gets its
  height from that chain, not a magic number. Inside it, the range chart and
  the numbers panel now grow to absorb whatever space the maker-mismatch and
  unknown-amount notices leave when they are not shown, instead of leaving a
  gap above an `mt-auto` bottom row; the position rows on the left do the same
  with the sidebar's leftover height. Verified with
  `document.documentElement.scrollHeight === clientHeight` on both a position
  with a pending proposal and notices, and one without.
- **Fit to the viewport (2026-09-06).** The dashboard uses the whole width:
  chart beside the numbers, the proposal band horizontal, agent / close /
  technical details in one row, list rows taller with their own range ruler;
  at 1512 × 785 everything of a position is visible without scrolling. The
  form and setup pages keep a reading width.
- **Dashboard layout and account control (2026-09-06).** The home is now a
  two-column panel: left, your name, the price with a compact ruler and the
  positions as selectable rows; right, the selected position in panels
  (proposal band, chart, numbers, agent and close side by side, technical
  details) — deep-linkable as `/?position=<label>`; `/positions/<label>` keeps
  working as a redirect. On a phone it is two views. The account chip in the
  header opens *Switch account* and *Disconnect from this app* (Ledger Live
  has no disconnect: the app forgets the account and stops using it here).
  Verified in the browser at 1389 and 390 px.
- **The Live App as a logbook (UX pass, 2026-09-06).** Designed before built:
  who arrives, the one decision per screen, the worst case (signing what was
  not understood). One accent, amber, reserved for "needs your signature";
  green and red only mean what they mean; numbers in a monospace face;
  hierarchy by size and space. Every screen enumerates its states (skeleton,
  empty, network error with retry, stale price, silent or stale agent, read-only
  browser outside Ledger Live, pending transaction). The **range chart**
  (price over the last 48 h from Chainlink rounds, the range as a band —
  `readPriceHistory` in core, one Multicall3 call) replaces the sentence
  "above the range"; the rows carry a compact ruler. The **proposal band** is
  pending and looks pending: amber edge, "awaiting your signature", two verbs,
  dismissable locally. **Review and sign** shows asset and amount first, the
  condition, what never happens, each signature with a concrete verb, what is
  reversible, the standing nature of the token permission and the blind-signing
  notice; contract addresses and hashes live behind "Technical details".
  Copy without protocol jargon (no ship/dock/allowance/calldata). Verified in
  the browser at 1440 and 390 px.

- **Phase 4, first cut: the agent watches, derives and proposes** (04 §4.4,
  05 §8, 06 §5; 2026-09-06). `packages/core/src/agent.ts` holds everything
  deterministic — thresholds v1 (`farFromRange` > 10 % while waiting,
  `completed`, `expiring` < 24 h; one proposal per trigger, cleared when the
  reason goes away), the reading, the fallback proposal (widen toward the
  price keeping the width, renew +30 days, close), the simulation in words,
  the prompt, the eight record values and the single `multicall` of `setText`
  that writes them — 25 tests, 94 % branches overall. `apps/agent` is the loop:
  registry and resolver from the name, positions from `LabelRegistered`,
  `readPositionView` + Chainlink price, one transaction per position per
  cycle, one pino line per position; `src/model.ts` asks Claude Opus 5
  through `beta.messages.parse` with `betaZodOutputFormat(Proposal)`,
  `fallbacks: "default"` and adaptive thinking, and any refusal or invalid
  answer falls back to the deterministic proposal. `AGENT_DRY_RUN=1` reads
  and logs without sending; dry-run against Sepolia sees `btc-dip` and
  `btc-dip-2`, both `farFromRange`, and would propose `widen`. Live App:
  **Accept proposal** on the detail screen (`acceptProposalCalls`: close, then
  for widen/narrow/renew ship and name the successor `<label>-N` with what was
  left). `apps/agent/deploy/`: systemd unit and a runner that reads the three
  secrets from Ledger Key Ring.
  **First real cycle on Sepolia** (agent key `0xf98d…4B32`, funded by the
  holder): one multicall per position — `btc-dip.salviega.eth`
  `0x699c334de0827e6d87e43126b431484201a86a5d3472087cf0c2478ab39fa5b0` (block
  11648313), `btc-dip-2.salviega.eth`
  `0xe76bfcefba87f1e2acb06507c075f11a15a21c641945602a4b7cb55a02e273d8`
  (11648315); `UniversalResolverV2` resolves `moor.agent.checkedAt`, `price
  79647.24`, `state waiting`, `filled 0.0%`, and a `widen` proposal to
  74,054–78,054 with its reasoning and simulation. The Claude call returned
  400 — the key is not scoped to a workspace and the API wants
  `anthropic-workspace-id` — so both proposals are the deterministic ones;
  `ANTHROPIC_WORKSPACE_ID` is now supported (env, Key Ring runner,
  `.env.example`). Still to do: the Claude path with a workspace id, the VPS.

- **Phase 3, first cut: the Live App has its five screens and signs through
  the Wallet API** (04 §5; 2026-09-05). Tested in the browser with the
  simulator against Sepolia; the device test is what closes the phase.
  - `packages/core`: `abi.ts` (the fragments the app touches), `session.ts`
    (`planNewPosition` → approve if needed → `ship` → `createPosition`;
    `closeCalls` → `dock` + `unregister`; `revokeAgentCall`, `setupAgentCall`;
    every `Call` carries the intent its ERC-7730 descriptor declares) and
    `reads.ts` (records through `UniversalResolverV2`, Aqua balances,
    Chainlink price, `deriveState`). **Parity pinned to Sepolia**: the plan
    built from the form reproduces the real `ship` calldata and the
    `strategyHash` of `0x35a9…b477` byte for byte, and the records the holder
    signed in `createPosition` `0xdb7e1132…`. New record `moor.amount` (the
    committed amount) so the converted share needs no event scan; the price
    source is decided: Chainlink BTC/USD `0x1b44…Ee43`. 76 tests, 98.7 % lines.
  - `apps/live-app`: **Positions** (names from the holder's registry via
    `LabelRegistered` logs, state, converted share, agent pulse), **New
    position → Review & sign** (plain-words "what will / will not happen",
    each signature with what the Ledger shows, sequential session with receipt
    waits), **Position detail** (range vs price, balances, expiry, agent panel
    with validated proposal, *Close* and *Revoke agent*), **First-time setup**
    (status of registry, resolver, roles and agent name; signatures stay in
    `SetupHolder.s.sol` — the cut 07 allows). The holder's name is chosen in
    the app and checked against the account (`addr(name)`); the account is
    remembered across loads through `account.list`. `lucide-react` added;
    components are hand-written, no shadcn.
  - `pnpm dev` adds an `ethereum_sepolia` account (the holder's address) to the
    simulator profile — it ships without one — so reads show the real names.
  - `/sign-test` removed: the real screens replaced it.
  - **`pnpm ledger:screens` works** (07 phase 3; open since phase 0): Ledger's
    clear-signing tester (`apps/clear-signing-tester` in
    `LedgerHQ/device-sdk-ts`, pinned to `bb0cc89381ca`, built into `.cs-tester/`)
    starts Speculos in Docker with the prebuilt Ethereum app 1.22.3, injects our
    four unsigned descriptors through its CAL interceptor, signs the six
    transactions of the flow (`@moor/core`'s new `demoFlow()`) and captures
    every screen. `ship`, `createPosition`, `dock`, `unregister` and
    `revokeAgent` are **clear-signed** on an emulated Flex — "Open Moor
    position", "Position name btc-dip", "Under name salviega.eth", "Agent
    address"… — and `approve` is blind-signed because it is Ledger's own ERC-20
    screen and the testnet token is not in Ledger's CAL. 55 screens and
    `results.json` under `packages/erc7730/screens/`; a manual `ledger-screens`
    workflow (`workflow_dispatch`, ~8 min) regenerates them and fails on any diff. Ledger Live itself still cannot
    load a local descriptor, so the Flex blind-signs the demo until a registry
    PR lands (`spec/feedback/03_ledger.md`).
  - **Verified on the device (2026-09-05):** from Ledger Live Desktop with the
    Ledger Flex, the Live App at getmoor.vercel.app created
    **`btc-dip-2.salviega.eth`** — 1,000 tUSDC buying tWBTC between 58k and 62k
    for 30 days — in one session of three signatures: `approve`
    `0x4c812fe62bfa3a6bb7ab46035a4942d109a24a53ebad095eac3ceef9721aed35` (block
    11643272), `ship`
    `0x0ba89ceb0fdba27838cba8835d5b4cb2d9c2f89a2496de4b4a188397ea0979c0` (11643274),
    `createPosition`
    `0x35f2c11e0a1721bbe1e9a84bfa54f0c1235ed5f33d63148062b37e0e21074f45`
    (11643276). Strategy `0xe803dd796833f17bcfbaea9966c5ac7741f283d7f81cb7c87b311515b946c71f`,
    maker = the Ledger account; `UniversalResolverV2` resolves `moor.strategy`,
    `moor.pair`, `moor.side`, `moor.range`, `moor.amount = 1000000000`,
    `moor.agent` and `addr`; `Aqua.safeBalances` shows 1,000 tUSDC / 0 tWBTC;
    expiry 1791239749 = the deadline. The first position the holder owns end to
    end. Blind-signed: the descriptors are not on the device yet.

### Changed

### Fixed

### Removed

## [0.4.0] - 2026-09-05

Phases 0, 1 and 2 of [the plan](./spec/definicion/07_plan-de-trabajo.md), all
closed on 2026-09-05. `0.2.0` and `0.3.0` were not cut when phases 0 and 1
merged (#7, #8); their entries are folded here rather than back-dated.

### Added

- **Phase 2: the name and the permissions — closed 2026-09-05, three days
  early.** `btc-dip.salviega.eth` exists on ENSv2 Sepolia, describes the
  position, and the agent demonstrably cannot touch it.
  - `packages/contracts/src/MoorRegistrar.sol`: stateless, ownerless.
    `createPosition` registers `<label>.<holder>.eth` in the holder's
    `UserRegistry` (expiry = the position's deadline, no
    `ROLE_CAN_TRANSFER_ADMIN` — non-transferable), writes `addr` and the
    `moor.*` records on the holder's existing resolver, and refuses any key
    outside `moor.*` or inside `moor.agent.*`. `setupAgent` registers
    `agent.<holder>.eth` once per holder and grants the agent's key
    `ROLE_SET_TEXT` on exactly the eight `moor.agent.*` keys, for any name of
    the resolver — ENSv2's `authorizeTextRoles` is **per key**, which retired
    the per-position agent subname of the original design (03 §3, 05 §7
    rewritten). `revokeAgent` is the kill switch. Only the root of both
    registry and resolver can call it. `MoorRoles` names every bitmap.
  - `test/MoorRegistrar.t.sol` (13) against the real `UserRegistry` and
    `PermissionedResolver` proxies: records written; only the holder; agent
    keys refused to the holder; non-transferable; `unregister`; expiry; the
    agent writes `moor.agent.*` and nothing else (position records, roles,
    registry all revert); `hasRoles` exact on the eight resources;
    `revokeAgent` silences; the holder can revoke Moor itself.
  - `packages/core/src/names.ts`: nodes, DNS encoding, EAC resources
    (`agentResources()` — what a judge checks), role bitmaps, record
    encoding, and `listPositions()` over `LabelRegistered` logs of the
    holder's registry (closes the "how to enumerate subnames" pending of
    05/06 §11: events, not `UniversalResolverV2`). 54 tests.
  - Scripts: `DeployRegistrar.s.sol` (`pnpm contracts:deploy:registrar`,
    deployer pays; writes `deployments/<chainId>.names.json` because
    `vm.writeJson` cannot add keys; runs with `--skip-simulation` because
    forge's on-chain simulation reports a spurious `CreateCollision` on the
    factory's CREATE2), `SetupHolder.s.sol` and `CreatePosition.s.sol` (the
    holder, `--ledger`). The whole flow was rehearsed on an Anvil fork of
    Sepolia impersonating the holder: `UniversalResolverV2` resolves
    `moor.strategy`, `moor.agent`, `moor.range`, `addr` of
    `btc-dip.salviega.eth` and `addr` of `agent.salviega.eth`; the agent's
    `setText(moor.agent.proposal)` succeeds and `setText(moor.strategy)`
    reverts; `hasRootRoles` is false for the agent everywhere.
  - ERC-7730: `calldata-MoorRegistrar.json` (`createPosition`, `setupAgent`,
    `revokeAgent`; lint clean), `calldata-PermissionedRegistry.json`
    (`setSubregistry`, `grantRootRoles`, `revokeRootRoles`, `grantRoles`,
    `revokeRoles`, `unregister`; ETHRegistry and the holder's registry) and
    `calldata-PermissionedResolver.json` (`grantRootRoles`, `revokeRootRoles`,
    `authorizeTextRoles`). The ENS ones lint with one warning: the proxies are
    not on Sourcify (`spec/feedback/02_ens.md`).
  - **Sepolia** (deployer `0x5b1dC626Fa6dD9c2f5FfceA5B0ddDc74aa368258`):
    `MoorRegistrar` `0xe6915D2E5e8Db86661a66472e5B178d0dB419966` — tx
    `0x4de2af32609b80e9d51fd03009ceb59543c2c197e6cf69e71b3bb44e62b14de2`, Sourcify
    `exact_match`; `salviega.eth`'s `UserRegistry` proxy for the **Ledger
    holder `0xAA1aEf44DDE610F433f271C6A8749139DD5162E1`**:
    `0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922` via `VerifiableFactory` (salt
    `keccak("moor", holder)`, root = holder) — tx
    `0x0170490fa68a22a8f0222cb8832b67356b5c831a93a2224dd156d06295ed9fa4`, block
    11642925. A first proxy, `0x6b1D890908f8cDEEF618dC3c278a76Bf28cf9E81` (tx
    `0x1cc1326ac4d04141a7759e0d341f1505f66f824f319d34866d2dd4e089f85941`), was
    rooted at `0xd7A4…564C`, the wallet that had registered `salviega.eth` —
    which turned out not to be on the Ledger; it is unused. The name is being
    transferred to the Ledger account with `safeTransferFrom` on the ETHRegistry.
    `DeployRegistrar` learnt `MOOR_REGISTRAR` (reuse the verified registrar) and a
    holder-derived salt. **The holder also needs their own resolver**: the one
    app.ens.dev created at registration kept its root roles on `0xd7A4…` after
    the transfer (`grantRootRoles` from the Ledger reverted with
    `EACCannotGrantRoles`), so `DeployResolver.s.sol` deploys a
    `PermissionedResolver` proxy rooted at the holder — `0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3`, tx
    `0xf98f21f04e3dd692d3e80cb0a1466b895c4f9a01638a0bc7f5f644aa73948a80`, block
    11642997 — and `SetupHolder` now starts with `setResolver` + `setAddr` on
    the name. Rehearsed again end to end on a Sepolia fork as the Ledger holder
    (`findResolver(salviega.eth)` → the new resolver). Finding recorded in
    `spec/feedback/02_ens.md`. `packages/core/src/addresses.ts` carries `moorRegistrar`.
  - **Signed by the holder on the Ledger Flex** (account `0xAA1a…62E1`,
    `m/44'/60'/0'/0/0`, blind-signed — descriptors reach the device in phase
    3): `setResolver` `0x79df7e129b4e5f745e99cf2ba802aad5ed767f2b3d89dd39c3ce1872e31114cf`, `setAddr` `0xf4aac0831ed809858fb98f70b8f7949f1384e5994d7d85c4a56f2794a7357b55` (a first `setAddr`, `0xfdce5239ce0495e87d85dbd12f2f3c3c48f118a0426e102a46104cb78c6de008`, wrote forge's default simulation sender because the script derived the value from `msg.sender`; fixed in the script and re-run), `setSubregistry` `0xf779c082ffb97d6eaaa342264120dac5dee1c4baa934b75d0c23e2886fd61ab6`, `grantRootRoles` on the registry `0xf57dae5fac438181a699a76bc18c2a0932ea4b7a248d99e7a0bb10900349a3fd` and on the resolver `0x6457e040220fefd8e19f70e67fe5036e91a1da3f47c1dbff2938ba039db6115e`, `setupAgent` `0x4a6f7b8cefba42412a66d9c4f364352dd79b45d881fc1a329ed10274820388f4`, `createPosition` `0xdb7e113201bbe1913d8f497d13b327c0b6c12567ae41b3ac6aaa92e902285d2c`.
    **Verified on Sepolia:** `UniversalResolverV2.resolve` returns
    `moor.version`, `moor.strategy` (`11155111:0x35a9…b477`), `moor.program`,
    `moor.pair`, `moor.side`, `moor.range` (`58000:62000`), `moor.agent`
    (`agent.salviega.eth`) and `addr` (the holder) for `btc-dip.salviega.eth`;
    `ownerOf` is the holder, `expiry` equals the program's deadline and the
    holder lacks `ROLE_CAN_TRANSFER_ADMIN`; the agent has `ROLE_SET_TEXT` on
    `(any name, moor.agent.*)`, none on `(btc-dip, moor.strategy)`, no root
    role anywhere and zero roles on the position — `eth_call` of its
    `setText(moor.agent.checkedAt)` succeeds and of `setText(moor.strategy)`
    reverts.

- **Phase 1: the program, and the rule that cannot fail — closed 2026-09-05,
  three days early, without plan B.**
  - `packages/contracts/src/MoorProgram.sol`: the one-directional
    concentrated-liquidity range order as a SwapVM program —
    `Deadline → JumpIfTokenIn(allowed, 38) → Deadline(0) → FeeFlatIn →
    XYCConcentrateSwap` — plus the Aqua order and its hash. No balances in the
    program: Aqua holds them. The trap is `Deadline(0)` because the official
    `AquaSwapVMRouter` does not dispatch `Revert` (`spec/feedback/01_1inch.md`).
  - `test/MoorProgram.t.sol` (8): fills in the allowed direction, reverts in
    the other (`DeadlineReached(0)` in `quote` and `swap`), stays bought after
    full conversion, honours the deadline, docks only for the maker, golden
    vectors. `test/MoorProgramInvariants.t.sol`: SwapVM's `CoreInvariants`
    harness passes over the program in the allowed direction.
  - `packages/core/src/program.ts`: `buildProgram`, `buildOrder`,
    `strategyHash`, `sqrtPriceX18`, `rangeToSqrtBounds` — byte-for-byte parity
    with Solidity pinned by golden vectors; `fees.ts` derives the holder's fee
    from each fill's gross `amountIn`. 44 tests, 100 % branches.
  - `ShipDemo.s.sol` / `DemoTaker.s.sol` (`pnpm demo:ship`, `pnpm demo:taker`,
    `MOOR_REVERSE=1`) — demo infrastructure, not product.
  - **Sepolia:** position `0x35a92a7debbc1ba1edecc1d42e08010af7001608847186b40dc6d10b3670b477` — 1,000 tUSDC buying tWBTC between 58k
    and 62k USDC/BTC, maker `0x5b1dC626Fa6dD9c2f5FfceA5B0ddDc74aa368258` —
    `ship` tx `0xf5bf8022d92eb2f7442ff783d3f7805e4b8274c1c8e2b00b7150a8ad5dac8355`; fill of 0.01 tWBTC → 605.857783 tUSDC (≈ 60,586
    USDC/BTC) tx `0xe76cc5cf16e51a611c96abe17bff7a79f487273c3de75ecbfb78180dac867501`; `deriveState()` over the live balances → `working`
    (60.6 % converted); the reverse direction reverts with `DeadlineReached(0)`.

- **Phase 0 closed (2026-09-05).** The last verification landed: from Ledger
  Live Desktop with a Ledger Flex, `/sign-test` signed and broadcast
  `TestToken.mint(0xAA1aEf44DDE610F433f271C6A8749139DD5162E1, 1,000e6)` on
  Sepolia — tx `0x3160e91f23a196f60c8dc8092c5e062ef9d97a399cd88d9a5c918c974321f392`, `status 1`, balance 1,000 tUSDC. The Wallet API carries
  arbitrary calldata; the WebHID plan B is retired. Two items move phase by
  design (`quote()` against a test position → phase 1; descriptors on the
  device → phase 3 via the ERC-7730 Tester); the Key Ring on the VPS waits for
  the host. A Ledger Live add-account finding (searching "Sepolia" returns a
  token, not the network, and leads to an Arbitrum account) is recorded with
  screenshots in `spec/feedback/03_ledger.md`.

- **`/sign-test` in the Live App** — the phase-0 diagnostic for the Wallet API:
  request an Ethereum Sepolia account, then sign and broadcast
  `TestToken.mint(account, 1,000 tUSDC)` (`amount` 0, `data` present) through
  `transaction.signAndBroadcast`. `Providers` wires `WalletAPIProvider` with
  a transport created client-side only (`WindowMessageTransport` in Ledger
  Live, the simulator's `STANDARD` profile under `pnpm dev`). Adds
  `bignumber.js` and `buffer` to the Live App.

- **Aqua and SwapVM live on Sepolia; the Live App live on Vercel; `salviega.eth`
  on ENSv2** (phase 0, 2026-09-05, deployer `0x5b1dC626Fa6dD9c2f5FfceA5B0ddDc74aa368258`, 0.0075 ETH):
  - Aqua `0xB8747B3e2F90154420165FB2fc4707D638797140` — tx `0x66beea8da42bf781827d09e035d32178763635b34a69dc38e61b6f79988808aa` — **Sourcify `exact_match`**: the redeployed
    bytecode is the official one byte for byte.
  - AquaSwapVMRouter `0xdD026eA05C9256A1162dC3d41102579458A804Cd` — tx `0x039c3354bc524c26c15006de99517ca7f38d3718fe672717d8c14d91e458f1a2` (owner = deployer, name
    `AquaSwapVMRouter`, version `1`).
  - TestWETH `0x10C5026152eB4f79119d6cFb75205aEB6E98dfA0` — tx `0x51c04d41a7d8ce3486c135b626ea36d54528bf0381315638ac8ce81048d06232`.
  - tWBTC `0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC` — tx `0x69b6c4c16ba6adc55cf697857e6cc23ae9ef32681f07f3c16579b6a25af27ced`; tUSDC `0x274aaB610937e018310cCedC0b05B543b75557AB` — tx `0x09d4e09fc4ccae6ec374a35a497e2089df33a86615f323adbb6a00b668492537` (open `mint`, demo only).

  `packages/core/src/addresses.ts` rewritten by `write-addresses.mjs`; the
  ERC-7730 descriptor now points at the real Aqua address and lints against
  its verified ABI. Live App at `https://getmoor.vercel.app` (Vercel project `moor`, Root
  Directory `apps/live-app`, Node 22, GitHub repo connected so merges to
  `main` deploy); `manifest.json` carries that URL. `salviega.eth` resolves
  through `UniversalResolverV2` (resolver `0xc93Ad19307813019b9595147823b035DD93ce363`).
  Key Ring initialised on the holder's laptop.

### Fixed

- `pnpm deploy` is a reserved pnpm command, so the contracts script is now
  `deploy:sepolia` (`pnpm contracts:deploy` still works).
- The root `prepare` script tolerates a missing `.git`, which is what Vercel's
  build has — it was failing `pnpm install` there.

- **Speculos verified end to end** (phase 0): with `qemu-user-static`
  installed, `pnpm ledger:emu` runs the prebuilt Ethereum app 1.22.3 on an
  emulated Flex; `getAppConfiguration` reports 1.22.3 and `getPublicKey
  m/44'/60'/0'/0/0` returns the Speculos test address
  `0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D` with `9000`. Home screen kept
  under `packages/erc7730/screens/` as evidence. Ledger's ERC-7730 Tester is
  now the documented path to preview our unsigned descriptors on Speculos;
  how it bypasses the PKI check is recorded as an open question in
  `spec/feedback/03_ledger.md`.

- **Sepolia tooling for phase 0, verified as far as it can be without the
  holder's wallet.** `script/Deploy.s.sol` redeploys official Aqua and
  `AquaSwapVMRouter` plus `TestWETH`, `tWBTC` (8 dec) and `tUSDC` (6 dec),
  writes `deployments/<chainId>.json`, and `scripts/write-addresses.mjs`
  turns that into the `moorSepolia` block of `packages/core/src/addresses.ts`
  — proven end to end against Anvil (`contracts:deploy:anvil`; `router.AQUA()`
  matches). The Sepolia run itself waits on `SEPOLIA_RPC_URL`,
  `DEPLOYER_PRIVATE_KEY` and faucet ETH.

  `packages/erc7730/descriptors/calldata-Aqua.json` — the ERC-7730 descriptor
  for `ship`/`dock`, generated from the compiled ABI and clean under
  `erc7730 lint` (device limits: owner ≤ 22, URL ≤ 26). Address is the zero
  placeholder until deploy.

  `pnpm ledger:emu` starts Speculos with the **prebuilt** Ethereum app
  (`LedgerHQ/app-ethereum` 1.22.3 ships an ELF per device — no build), and
  checks for `qemu-user-static` first, which is the one system package pip
  cannot install. `@ledgerhq/wallet-cli` 2.1.0 installed; `ring init` needs
  the device. Three Ledger findings (prebuilt ELFs, the qemu dependency, the
  undocumented headless Key Ring enrolment) are in `spec/feedback/`.

- **Phase 0 scaffolding: the monorepo exists and every check is green.**
  pnpm workspaces with `apps/live-app` (Next.js 16, empty page wired for
  Sepolia, Wallet API deps declared), `apps/agent` (env validation, a cycle
  that does nothing yet), `packages/core` (the one implementation of a
  position: `PositionParams`, `deriveState()`, record schemas, ENSv2 Sepolia
  addresses — 20 tests, 100% coverage against the 90% floor),
  `packages/erc7730` (descriptor layout, `ledger:emu`/`ledger:screens`
  placeholders) and `packages/contracts` (Foundry). Biome, `.nvmrc`,
  `.githooks` (pre-commit lint/fmt, pre-push refuses `main`), and a PR-only
  GitHub Actions workflow with a TypeScript job and a Foundry job.

  **SwapVM, Aqua and ENSv2 compile together under one toolchain** — solc
  0.8.30, via-IR, cancun, the settings they pin — proven by
  `test/Deps.t.sol`. Getting there took two decisions worth recording:
  SwapVM and Aqua resolve dependencies through `node_modules` and their npm
  packages are not published, so OpenZeppelin 5.4.0 and `@1inch/solidity-utils`
  6.9.10 come in as submodules; and Foundry's resolver ignores solc context
  remappings, so ENSv2's own OpenZeppelin 5.3.0 cannot be scoped to its tree
  — everything builds against 5.4.0, which is source-compatible. Both are in
  `spec/feedback/` as the first real entries.

  Dependencies are pinned by tag where the upstream has one (`swap-vm`
  v1.0.2, `aqua` v1.0.0, `openzeppelin-contracts` v5.4.0, `solidity-utils`
  6.9.10, `forge-std` v1.16.2) and by commit where it does not
  (`contracts-v2`).

- **Test coverage floor: 90% on `packages/core`, no blanket number on
  contracts.** `packages/core`'s Vitest coverage thresholds
  (lines/functions/branches/statements) are enforced inside `pnpm test`
  itself — the command fails under the floor, there is no separate
  coverage-check step, the same mechanism as the 80% floor on
  `cuente-conmigo`. Contracts run `forge coverage --report summary` in CI,
  but are held to the three named critical tests (the direction gate, the
  agent's negative roles, `strategyHash` parity) rather than a percentage: a
  small, security-critical contract earns more from exhaustive coverage on
  its decision branches than from hitting a uniform number by testing
  getters. Documented in `AGENTS.md`, `spec/definicion/06_tecnologias.md`
  §6/§9, and the PR template checklist.

