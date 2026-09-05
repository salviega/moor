/** The one pair of the hackathon demo (05 §1): test tokens with open mint, Sepolia only. */
import { moorSepolia, type Pair } from "@moor/core";

export const demoPair: Pair = {
	base: { address: moorSepolia.testWbtc, decimals: 8, symbol: "tWBTC" },
	quote: { address: moorSepolia.testUsdc, decimals: 6, symbol: "tUSDC" },
};

export const explorer = (kind: "tx" | "address", id: string) =>
	`https://sepolia.etherscan.io/${kind}/${id}`;
