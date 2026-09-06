/**
 * The hackathon demo trades two pairs against tUSDC (05 §1): BTC and ETH, both
 * test tokens on Sepolia. The Live App lets the holder choose one when opening
 * a position; the agent and the app both need to know which one an *existing*
 * position already is — from its own token addresses, never a guess.
 */
import type { Address } from "viem";
import { moorSepolia } from "./addresses";
import type { Pair } from "./session";

export const btcPair: Pair = {
	base: { address: moorSepolia.testWbtc, decimals: 8, symbol: "tWBTC" },
	quote: { address: moorSepolia.testUsdc, decimals: 6, symbol: "tUSDC" },
};

export const ethPair: Pair = {
	base: { address: moorSepolia.testWeth, decimals: 18, symbol: "tWETH" },
	quote: { address: moorSepolia.testUsdc, decimals: 6, symbol: "tUSDC" },
};

export const demoPairs: readonly Pair[] = [btcPair, ethPair];

const holds = (p: Pair, addr: Address) =>
	p.base.address.toLowerCase() === addr.toLowerCase() ||
	p.quote.address.toLowerCase() === addr.toLowerCase();

/** Which demo pair a position's own tokens are. Reading only — creating a position picks a pair explicitly. */
export function resolveDemoPair(tokenIn: Address, tokenOut: Address): Pair {
	return demoPairs.find((p) => holds(p, tokenIn) && holds(p, tokenOut)) ?? btcPair;
}
