/**
 * One signature for a whole session (08 roadmap, the EIP-7702 path). The holder's
 * EOA, delegated to the one account contract the Ledger Ethereum app whitelists,
 * executes every call of a session as a single `executeBatch` on itself. Inside,
 * `msg.sender` is still the holder — Aqua's maker is still the Ledger, the
 * registrar still sees the root of the holder's names — which is why this, and
 * not a helper contract, is the only batching Moor can use (AGENTS.md, Security).
 * Two pure halves: recognising a delegated account from its code, and wrapping a
 * session's calls into the one call the Ledger signs. Whether the device shows
 * that call in words is the descriptor's job: packages/erc7730.
 */
import { type Address, encodeFunctionData, getAddress, type Hex, isAddress, parseAbi } from "viem";
import type { Call } from "./session";

/**
 * eth-infinitism's Simple7702Account — the only EIP-7702 delegate the Ledger
 * Ethereum app accepts (whitelisted for every chain). Same bytecode at this
 * address on Sepolia and on Base; not a Moor contract, and never the maker.
 */
export const SIMPLE_7702_ACCOUNT =
	"0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9" as const satisfies Address;

export const simple7702AccountAbi = parseAbi([
	"struct Call { address target; uint256 value; bytes data; }",
	"function executeBatch(Call[] calls) payable",
]);

/** The EIP-7702 delegation indicator: `0xef0100` ‖ 20-byte delegate. Anything else is not a delegated EOA. */
export function delegateOf(code: Hex | undefined): Address | null {
	if (!code || code.length !== 2 + 6 + 40) return null;
	if (!code.toLowerCase().startsWith("0xef0100")) return null;
	const delegate = `0x${code.slice(8)}`;
	return isAddress(delegate) ? getAddress(delegate) : null;
}

/**
 * What the Live App signs: one batch when — and only when — the holder's account
 * is delegated to the delegate the Ledger app accepts and the session has more
 * than one call. Anything else signs exactly as before. The opt-in happened on
 * chain (the holder delegated); the app only reads it.
 */
export function sessionCalls(input: {
	holder: Address;
	code: Hex | undefined;
	calls: Call[];
}): Call[] {
	const { holder, code, calls } = input;
	if (calls.length < 2) return calls;
	if (delegateOf(code) !== SIMPLE_7702_ACCOUNT) return calls;
	return [batchCall(holder, calls)];
}

/** Every call of a session as one `executeBatch` on the holder's own address: in order, all or nothing. */
export function batchCall(holder: Address, calls: Call[]): Call {
	if (calls.length === 0) throw new Error("batchCall: empty batch");
	return {
		kind: "batch",
		to: holder,
		data: encodeFunctionData({
			abi: simple7702AccountAbi,
			functionName: "executeBatch",
			args: [calls.map((c) => ({ target: c.to, value: 0n, data: c.data }))],
		}),
		intent: `One signature, ${calls.length} steps: ${calls.map((c) => c.ledgerShows).join(" · ")}. Your account runs them itself, in order, all or nothing.`,
		ledgerShows: "Moor: all steps in one",
	};
}
