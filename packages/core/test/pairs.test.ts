import { describe, expect, it } from "vitest";
import { moorSepolia } from "../src/addresses";
import { btcPair, ethPair, resolveDemoPair } from "../src/pairs";

describe("the demo's two pairs", () => {
	it("both trade against tUSDC, each at its own base decimals", () => {
		expect(btcPair.quote.address).toBe(moorSepolia.testUsdc);
		expect(ethPair.quote.address).toBe(moorSepolia.testUsdc);
		expect(btcPair.base).toEqual({ address: moorSepolia.testWbtc, decimals: 8, symbol: "tWBTC" });
		expect(ethPair.base).toEqual({ address: moorSepolia.testWeth, decimals: 18, symbol: "tWETH" });
	});

	it("resolves a position's own pair from its two token addresses, in either order", () => {
		expect(resolveDemoPair(moorSepolia.testUsdc, moorSepolia.testWbtc)).toBe(btcPair);
		expect(resolveDemoPair(moorSepolia.testWeth, moorSepolia.testUsdc)).toBe(ethPair);
	});

	it("is case-insensitive and falls back to BTC for anything unrecognized — it never throws", () => {
		expect(
			resolveDemoPair(
				moorSepolia.testUsdc.toUpperCase() as typeof moorSepolia.testUsdc,
				moorSepolia.testWbtc,
			),
		).toBe(btcPair);
		expect(
			resolveDemoPair(
				"0x0000000000000000000000000000000000000001",
				"0x0000000000000000000000000000000000000002",
			),
		).toBe(btcPair);
	});
});
