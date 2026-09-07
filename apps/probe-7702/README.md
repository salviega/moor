# @moor/probe-7702

A dev-only probe, **not the Live App and not shipped**: the EIP-7702 one-signature
path on a physical Ledger, over WebHID, on Sepolia. It exists to answer one question
before Moor commits to that path (08 roadmap): when the holder's account is delegated
to the account contract Ledger whitelists, **what does the Flex show for one
`executeBatch` to self** carrying a whole Moor session — words, or raw calldata?

Why it lives outside the Live App: Ledger Live's Wallet API signs neither an EIP-7702
authorization nor a type-4 transaction, and its webview has no WebHID. So this page
talks to the device directly through Ledger's Device Management Kit — the same stack
and the same flow Streams verified on this same Flex (`web/src/lib/ledger-7702.ts` in
`JulioMCruz/Streams`). AGENTS.md's "the Wallet API and nothing else" is a rule for the
Live App; this is a measuring instrument.

## What it does (each step is a tap on the device; nothing moves without one)

1. **Connect** over WebHID; shows the address, whether it is already delegated
   (`0xef0100‖delegate` in its code), tUSDC balance and allowance to Aqua.
2. **Dry run**: sign the delegation authorization only, recover the signer, compare.
   Nothing is broadcast.
3. **Delegate** to `Simple7702Account` (`0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9`,
   the only 7702 delegate the Ethereum app accepts): one self-sponsored type-4
   transaction — authorization nonce = tx nonce + 1. Two taps: the delegation
   (clear-signed by the app itself) and the transaction.
4. **One signature**: the Live App's own `planNewPosition` (approve if needed · ship ·
   createPosition), wrapped by `@moor/core`'s `batchCall` into one `executeBatch` on
   the holder's own address, sent as an ordinary type-2 transaction. Every inner call
   runs with `msg.sender == holder`, so Aqua's maker is still the Ledger.
5. **Undo**: delegate to `0x0` (clears the code).

## Requirements

- Chrome or Edge (WebHID). **Close Ledger Live** — it owns the device.
- Ethereum app open on the Flex, **Settings → Smart account upgrade: enabled**
  (off by default; the device refuses 7702 signatures otherwise).
- Sepolia ETH on the account for gas; tUSDC for step 4 (open mint, see README).

```sh
pnpm --filter @moor/probe-7702 dev     # http://localhost:5177
```

## What to look at on the device

- Step 3: "Delegate to Simple7702Account · Sepolia · upgrade into smart contract
  account" — clear, hardcoded in the app, no descriptor involved.
- Step 4, the actual finding: either **"Review transaction 1 of N"** with each inner
  call in words (Ledger's metadata service resolved the delegate behind your address —
  its `ProxyContextFieldLoader` does exactly this for proxies, PKI-signed, server-side),
  or **"This transaction cannot be clear-signed"** (it does not, yet). The inner Moor
  calls are blind on a production device either way until our descriptors are in
  Ledger's registry — same as `ship` and `createPosition` today. The Speculos side of
  this question is answered in `packages/erc7730/screens/batch7702*`.

Write down what you saw in `spec/feedback/03_ledger.md`, with the tx hashes.
