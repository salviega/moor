import { describe, expect, it } from "vitest";
import { accrue, feeEarnedFromGrossIn } from "../src/fees";

describe("feeEarnedFromGrossIn", () => {
	it("is 0.3 % of the gross for feeBps 30000 (SwapVM units, 1e7 = 100 %)", () => {
		expect(feeEarnedFromGrossIn(1_000_000n, 30_000)).toBe(3_000n);
	});
	it("matches the Sepolia fill: 0.01 tWBTC gross at 0.3 %", () => {
		// tx 0xe76cc5cf…7501: amountIn 1_000_000 (1e6 = 0.01 tWBTC), so 3_000 raw stays as fee
		expect(feeEarnedFromGrossIn(1_000_000n, 30_000)).toBe(3_000n);
	});
	it("is zero at zero fee and zero amount", () => {
		expect(feeEarnedFromGrossIn(123n, 0)).toBe(0n);
		expect(feeEarnedFromGrossIn(0n, 30_000)).toBe(0n);
	});
	it("rounds against the taker, never negative", () => {
		expect(feeEarnedFromGrossIn(1n, 30_000)).toBe(1n); // floor(1 * 0.997) = 0 net → whole wei is fee
	});
	it("rejects nonsense", () => {
		expect(() => feeEarnedFromGrossIn(-1n, 30_000)).toThrow(/negative/);
		expect(() => feeEarnedFromGrossIn(1n, 10_000_000)).toThrow(/feeBps/);
	});
});

describe("accrue", () => {
	it("sums fills and their fee share", () => {
		const r = accrue(
			[
				{ amountIn: 1_000_000n, amountOut: 605_857_783n },
				{ amountIn: 500_000n, amountOut: 300_000_000n },
			],
			30_000,
		);
		expect(r).toEqual({ grossIn: 1_500_000n, out: 905_857_783n, fees: 4_500n });
	});
	it("is empty for no fills", () => {
		expect(accrue([], 30_000)).toEqual({ grossIn: 0n, out: 0n, fees: 0n });
	});
});
