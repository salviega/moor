/**
 * The two pairs of the hackathon demo (05 §1): both against tUSDC, both test
 * tokens with a real Sepolia address. The Live App is what adds the icon and
 * the label — `@moor/core`'s `btcPair`/`ethPair`/`resolveDemoPair` are the
 * ones the agent reads with, so a position looks the same both places.
 */
import { btcPair, resolveDemoPair as coreResolveDemoPair, ethPair, type Pair } from "@moor/core";
import type { Address } from "viem";

export interface DemoPair {
	id: "btc" | "eth";
	label: string;
	icon: string;
	pair: Pair;
}

export const btcDemo: DemoPair = { id: "btc", label: "BTC", icon: "/token-btc.png", pair: btcPair };
export const ethDemo: DemoPair = { id: "eth", label: "ETH", icon: "/token-eth.png", pair: ethPair };
export const demoPairs: readonly DemoPair[] = [btcDemo, ethDemo];

export const usdcIcon = "/token-usdc.png";

/** Kept for the couple of call sites that predate the ETH pair and only ever meant "the demo pair". */
export const demoPair = btcPair;

/** Which demo pair an *existing* position is, from its own token addresses — reading only. */
export function resolveDemoPair(tokenIn: Address, tokenOut: Address): DemoPair {
	const resolved = coreResolveDemoPair(tokenIn, tokenOut);
	return demoPairs.find((d) => d.pair.base.address === resolved.base.address) ?? btcDemo;
}

/** The token icon for a base-asset address (btcDemo/ethDemo), or the quote (tUSDC) otherwise. */
export function tokenIcon(address: Address): string {
	const asBase = demoPairs.find((d) => d.pair.base.address.toLowerCase() === address.toLowerCase());
	return asBase?.icon ?? usdcIcon;
}

export const explorer = (kind: "tx" | "address", id: string) =>
	`https://sepolia.etherscan.io/${kind}/${id}`;
