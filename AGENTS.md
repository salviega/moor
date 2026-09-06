# Moor

Turns the waiting time of holding into productive capital: a position signed once
from a Ledger that earns fees through 1inch Aqua while the tokens never leave the
wallet, already contains the order that fills when the price arrives, and has an
ENS name anyone can read. An agent watches and proposes; the Ledger decides.

The definition lives in `spec/definicion/` (eight documents, in Spanish);
`07_plan-de-trabajo.md` is the phased plan and doubles as the progress log —
completed items are struck through there. `08_roadmap.md` is what comes after
the hackathon. Read `03_bounties.md` before touching anything a judge will see:
it lists what disqualifies.

## Language

English for everything technical: code, comments, identifiers, contract and
function names, commit messages, PR descriptions, this file, the README and the
CHANGELOG.

Spanish for the definition documents under `spec/definicion/**`. Nothing else.

The interface ships in **English only**. The judges of the three tracks read
English; the person building this reads both. There is no i18n layer and none
should be added during the hackathon — a single locale is one less rule to break
on every screen. User-facing strings still live in one place per screen, not
scattered through JSX, so the day a second locale arrives it is a move, not a hunt.

## The commit ritual

No commit lands without this, in this order. A failing step is a blocker, not a
warning to note and move past.

1. **Tests first, and they have failed once.** `pnpm test` (Vitest on
   `packages/core`, **coverage at 90% or above** — lines, functions, branches
   and statements, enforced by `vitest.config.ts`'s own `coverage.thresholds`
   so the command itself fails under the floor, not a separate step) and
   `forge test` (in `packages/contracts`) pass. A test that guards a promise
   in `04_diseno-de-solucion.md` — the direction gate, the agent's negative
   roles, `strategyHash` parity — was written before the code and seen
   failing for the expected reason.
2. `pnpm typecheck` — clean.
3. `pnpm check` (Biome) and `forge fmt --check` — clean.
4. **Every signable function has its ERC-7730 descriptor and a Speculos screen.**
   Adding or changing anything the holder signs — a `MoorRegistrar` function, a
   record layout that changes what the screen must say — means the descriptor in
   `packages/erc7730/` changes in the same commit and `pnpm ledger:screens`
   regenerates its capture. A screen that says `data: 0x…` is a bug, not a to-do.
5. Review whether the change makes any of these stale, and update what it does:
   `spec/definicion/**` (strike through what the commit completes in `07`; if a
   risk closed, say which way), the README, `AGENTS.md`, and `.claude/`.
6. `CHANGELOG.md` — add the entry under `Unreleased`, with the Sepolia tx hashes
   for anything that happened on chain. **No version number and no
   `package.json` bump on a branch**: the number is assigned when the branch
   merges to `main` — patch for ordinary work, minor when a phase of the plan
   closes.
7. **Then check `spec/feedback/`.** Now that the entry above is written, ask
   whether this commit also surprised you about a sponsor's docs or SDK — an
   opaque error, an undocumented limit, something that worked better than
   expected. If it is pertinent and worth keeping, it goes in the matching
   file the same day, with the exact evidence while it is still in front of
   you. Most commits have nothing here, and that is the normal case — do not
   pad the log to have made an entry.
8. Then, and only then, commit.
9. **If the branch has an open pull request, the body is part of the change.**
   Pushing a commit that adds a capability, a risk, a dependency or a decision
   means the description no longer matches what would be merged. Update it in
   the same breath as the push: what changed in the first section, how it was
   checked in the second, what it costs or risks in the last one.

**Commit every day.** 1inch disqualifies a repository whose history is a single
entry on the final day, and the other two tracks read the log too. A day with no
commit is a day the judges cannot see. Small commits, pushed.

**Do not watch the run after pushing.** No background monitor, no `gh run watch`
— push and move on. The checks above already ran locally; CI is the second
opinion, not the first. When a failure does come back, reproduce it locally
before touching the fix.

Commits follow Conventional Commits, written in English. No `Co-Authored-By`
trailers and no mention of AI authorship.

## Branches and deployment

Work happens on `feature/**` (or `fix/**`, `chore/**`), never directly on `main`.
`main` is merged into only through a pull request.

**CI runs on the pull request and nowhere else.** Pushing a branch spends no
minutes: the ritual already ran locally. The verdict is spent where it decides
something — on the merge.

**Pushing straight to `main` is refused** by `.githooks/pre-push`, which
`pnpm install` wires up through the `prepare` script. It is a local guard —
this repository is on the free plan and branch protection is not available —
and `git push --no-verify` walks around it, which is the point: it takes a
deliberate act, not a habit.

What a merge to `main` sets off, and what it does not:

| Trigger              | Effect                                                                          |
| -------------------- | ------------------------------------------------------------------------------- |
| Push to `feature/**` | Nothing. No workflow is triggered                                               |
| Pull request         | CI: `check`, `typecheck`, Vitest, `forge test`, Live App build                    |
| `ledger-screens` (manual) | `pnpm ledger:screens` on an emulated Flex, diffed against the committed captures — run it when a descriptor changes |
| Merge to `main`      | Vercel deploys the Live App to production — the URL in `manifest.json`          |

**Contracts and the agent do not deploy on merge.** `pnpm contracts:deploy` is
run by hand, against Sepolia only, and writes the new addresses into
`packages/core/src/addresses.ts` — that file changing is what a contract
deployment looks like in a diff, and it ships with the tx hashes in the
CHANGELOG. The agent is restarted on its host by hand after a pull. Neither has
a mainnet target and neither should acquire one during the hackathon.

**The Live App deploy is not gated by CI.** Vercel reacts to the push, not to
the workflow, so a red merge still reaches the manifest's URL. What stands in
the way is the local hook and the discipline: the pull request is green before
it merges.

## Tests come first

Unit tests are written before the implementation, not after it. Write the
failing test, watch it fail for the reason you expect, then make it pass. A test
that has never failed has never proven anything.

Three tests carry the product, and each guards a sentence in the spec:

- **The direction gate** (`04 §6`): a swap that would sell what the position is
  buying reverts — `quote` and `swap` both, with `DeadlineReached(0)` from the
  trap at PC 31. `test/MoorProgram.t.sol` and the `CoreInvariants` harness in
  `test/MoorProgramInvariants.t.sol`. This was the first risk in the plan; it
  closed on September 5 without plan B.
- **The agent's negative roles** (`05 §7`): `setText` on the position,
  `grantRoles`, `unregister`, `renew`, `dock` — each attempted from the agent's
  key, each reverting; `hasRoles` false for everything but its own text record.
- **`strategyHash` parity**: `buildProgram()` in TypeScript and
  `MoorProgramFactory` in Solidity produce the same bytes. If they drift, the
  Live App is showing one thing and signing another.

Contract tests run against SwapVM's `CoreInvariants` as well as our own: a
program that breaks exact-in/exact-out symmetry behaves strangely with real
takers even if every Moor test is green.

**Contracts don't carry a blanket coverage number.** `forge coverage` runs in
CI and the report is read, but a suite hitting 90% by testing getters is
worth less than one that misses 90% while covering every negative-role case
and the direction gate above. The three named tests are the actual floor;
the percentage is a signal, not the gate, here.

## Security

The OWASP Top 10 is the baseline, applied to what this project actually handles
— a holder's capital that must never be custodied, a hot key that can write one
kind of record, and the secrets an unattended process needs:

- **No Moor contract is ever the maker, and none ever holds an approval.**
  `ship` and `dock` are called by the holder's wallet directly; a helper that
  called them for the holder would become the maker and receive the tokens.
  There is no function in `MoorRegistrar` that touches Aqua, and there should
  never be one.
- **Authorization lives on chain.** Who may write which ENS record is an EAC
  role checked by the resolver and the registry, never a condition in a
  component. If a rule can be expressed as a role, it belongs in a role — and
  `hasRoles` is how anybody, judge included, verifies it without trusting us.
- **The agent's key does one thing.** `ROLE_SET_TEXT` on the eight `moor.agent.*` keys; no
  registry role, no admin role, no approval, not the maker. A change that gives
  it anything else is a change to the product, goes through the spec first, and
  is what `08_roadmap.md` §1b exists to do properly.
- **Secrets come from Key Ring, never from a file.** `AGENT_PRIVATE_KEY`,
  the RPC key and `ANTHROPIC_API_KEY` are read from `wallet-cli ring` on the
  host. A `.env` holding the agent's key is a leak waiting for a `git add`.
  `DEPLOYER_PRIVATE_KEY` is local, for `contracts:deploy` only, never in CI.
- **Every input crosses a Zod schema at the trust boundary**: position
  parameters from the form, records read back from ENS, and **the model's
  output** — a proposal that does not validate is not written, full stop.
- **No signing without Clear Signing.** A transaction the Ledger would show as
  raw calldata does not ship. The descriptor is part of the function.
- **No private keys, seeds or API keys in logs, URLs or error messages.** The
  agent logs what it read and what it derived; never what it signed with.
- **Escape by default.** No `dangerouslySetInnerHTML`; ENS text records are
  attacker-writable by design (the agent's key could be stolen) and are rendered
  as text, never as markup or links.
- **Dependencies are a supply chain.** `forge install` targets are pinned to a
  commit, not a branch, once phase 1 closes. Adding an npm package is a
  decision, not a reflex.
- **Speculos is not a wallet.** Ledger says so: no firmware, a reimplemented SDK,
  not for holding funds. Its seed is a test seed and nothing of value ever
  touches it.

## Stack conventions

Reach for these when the need actually appears — installing a library ahead of
the need is how a small project stops being small:

| Need                                   | Choice                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Reading the chain                      | viem, through `packages/core` — never a raw ABI call in a component          |
| Signing                                | The Wallet API (`@ledgerhq/wallet-api-client-react`) and nothing else. No private key exists in the Live App |
| Server state, polling, refetching      | TanStack Query                                                              |
| Forms                                  | React state + `useActionState`, validated with the shared Zod schema. Two forms; no form library |
| Schemas and types                      | Zod in `packages/core`; types are inferred from schemas, never written twice |
| Icons                                  | `lucide-react`                                                              |
| Confirming a save to the person        | One toast utility, shared — never a new inline banner                       |
| Talking to the model                   | `@anthropic-ai/sdk`, `claude-opus-5`, `messages.parse()` against the proposal schema, `fallbacks: "default"`. One call per proposal, none per cycle |
| Logs in the agent                      | `pino`, one structured line per cycle                                       |

Most state never touches Moor: balances live in Aqua, the program in SwapVM, the
records in ENS. `packages/core` derives; it does not store.

## Contract and chain work

The program, the registrar and the roles are the product's core, not an
implementation detail — see `spec/definicion/05_stack-y-arquitectura.md` §5 to §7.

Three things never get traded away for speed: the direction gate in the program,
the agent's negative roles, and `strategyHash` parity. A position that sells back
what it bought, an agent that can touch a strategy, or a screen that shows a
different program than the one signed each break trust for good — and each is
the thing a judge would find.

**Sepolia only.** Aqua and SwapVM are redeployed there from their official,
unmodified sources (`packages/contracts/lib/`); the canonical production
addresses do not apply and must not appear in `packages/core/src/addresses.ts`.
The ENSv2 addresses are the published Sepolia beta ones and are constants, not
environment variables.

**Every deployment is a diff and a hash.** `pnpm contracts:deploy` rewrites
`addresses.ts`; the commit that carries it carries the tx hashes in the
CHANGELOG. A contract address that cannot be traced to a hash in the log did not
happen.

**Every signable function ships with its ERC-7730 descriptor and its Speculos
capture**, in the same commit — `packages/erc7730/` for the descriptor,
`packages/erc7730/screens/` for what the device shows. `pnpm ledger:screens`
regenerates the captures and CI diffs them: a descriptor change that alters a
screen fails the build, not the demo.

**Local first, then Sepolia.** Anvil forks Sepolia for the fast loop; the phase
does not close until the same thing happened on Sepolia itself with a hash to
show. The demo taker (`pnpm demo:taker`) is demo infrastructure — there are no
real takers on Sepolia — and is labelled as such everywhere it appears.

## The agent

It runs headless, every 300 seconds, and each cycle starts from reading the
chain — it has no memory it cannot lose. It reads price and balances, derives
state with `packages/core`, and writes `moor.agent.*` on the position name. That
is the whole of what it can do, and the negative-role tests are what say so.

When a threshold crosses it makes one call to the model, validates the answer
against the proposal schema, and writes it — or does not. It never builds,
signs or sends a transaction to Aqua, the registry or the position's records,
and there is no code path in `apps/agent` that could. If the agent is down, the
Live App shows a stale `checkedAt` and the position keeps working: the agent was
never in the loop that mattered.
