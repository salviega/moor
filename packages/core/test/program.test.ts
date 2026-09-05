import { describe, expect, it } from "vitest";
import {
	buildOrder,
	buildProgram,
	DIRECTION_TRAP,
	encodeStrategy,
	instruction,
	isqrt,
	MAIN_PC,
	parseDecimal,
	rangeToSqrtBounds,
	sortPair,
	sqrtPriceX18,
	strategyHash,
	toBytes32,
} from "../src/program";

/** Golden vectors printed by `forge test --match-test test_goldenVectors -vv` (MoorProgram.t.sol). */
const golden = {
	params: {
		tokenA: "0x1111111111111111111111111111111111111111" as const,
		tokenB: "0x2222222222222222222222222222222222222222" as const,
		takerTokenIn: "0x2222222222222222222222222222222222222222" as const,
		feeBps: 30_000,
		deadline: 1_800_000_000,
		sqrtPriceMin: 707_106_781_186_547_524n,
		sqrtPriceMax: 1_414_213_562_373_095_048n,
	},
	holder: "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1" as const,
	program:
		"0x2005006b49d200311622222222222222222222222222222222222222220026200500000000007003007530514000000000000000000000000000000000000000000000000009d025defee4df4400000000000000000000000000000000000000000000000013a04bbdfdc9be88",
	traits: 0x4000000000280028002800280000000000000000000000000000000000000000n,
	strategyHash: "0x31c9278f865aae47e32becd87c68d1ad48852e9f7bc359085ea4578d334874aa",
};

describe("buildProgram — parity with MoorProgram.sol", () => {
	it("produces the golden bytes", () => {
		expect(buildProgram(golden.params)).toBe(golden.program);
	});
	it("has the documented layout", () => {
		const bytes = buildProgram(golden.params);
		expect((bytes.length - 2) / 2).toBe(38 + 5 + 66);
		expect(bytes.slice(2, 4)).toBe("20"); // Deadline
		expect(bytes.slice(2 + 7 * 2, 4 + 7 * 2)).toBe("31"); // JumpIfTokenIn
		expect(bytes.slice(2 + 31 * 2, 4 + 31 * 2 + 12)).toBe("20050000000000"); // Deadline(0): the trap
		expect(DIRECTION_TRAP).toBe(0);
		expect(bytes.slice(2 + MAIN_PC * 2, 4 + MAIN_PC * 2)).toBe("70"); // FeeFlatIn
		expect(bytes.slice(2 + 43 * 2, 4 + 43 * 2)).toBe("51"); // XYCConcentrateSwap
	});
	it("rejects unsorted tokens, a taker token outside the pair, and a bad range", () => {
		expect(() =>
			buildProgram({
				...golden.params,
				tokenA: golden.params.tokenB,
				tokenB: golden.params.tokenA,
			}),
		).toThrow(/sorted/);
		expect(() =>
			buildProgram({
				...golden.params,
				takerTokenIn: "0x000000000000000000000000000000000000beef",
			}),
		).toThrow(/pair/);
		expect(() =>
			buildProgram({ ...golden.params, sqrtPriceMin: golden.params.sqrtPriceMax }),
		).toThrow(/sqrtPriceMin/);
		expect(() => buildProgram({ ...golden.params, feeBps: 10_000_000 })).toThrow(/feeBps/);
		expect(() => buildProgram({ ...golden.params, deadline: 0 })).toThrow(/deadline/);
	});
});

describe("buildOrder / strategyHash — parity with Aqua and SwapVM.hash", () => {
	const order = buildOrder(golden.holder, golden.params);
	it("packs the Aqua flag and the no-hook data indexes into traits", () => {
		expect(order.traits).toBe(golden.traits);
	});
	it("lays out data as tokenA ‖ tokenB ‖ program", () => {
		expect(order.data).toBe(
			`0x${golden.params.tokenA.slice(2)}${golden.params.tokenB.slice(2)}${golden.program.slice(2)}`.toLowerCase(),
		);
	});
	it("hashes to the golden strategyHash", () => {
		expect(strategyHash(order)).toBe(golden.strategyHash);
	});
	it("encodeStrategy is what keccak256 hashes", () => {
		expect(encodeStrategy(order).length).toBeGreaterThan(2);
	});
});

describe("instruction encoding", () => {
	it("refuses args of 256 bytes or more — the length byte cannot hold them", () => {
		expect(() => instruction(0x01, `0x${"00".repeat(256)}`)).toThrow(/too long/);
		expect(instruction(0x20, "0x0000000000")).toBe("0x20050000000000");
	});
	it("toBytes32 left-pads", () => {
		expect(toBytes32("0x01")).toBe(`0x${"00".repeat(31)}01`);
	});
});

describe("prices", () => {
	it("isqrt rejects negatives", () => {
		expect(() => isqrt(-1n)).toThrow(/negative/);
	});
	it("isqrt floors like OpenZeppelin Math.sqrt", () => {
		expect(isqrt(0n)).toBe(0n);
		expect(isqrt(1n)).toBe(1n);
		expect(isqrt(3n)).toBe(1n);
		expect(isqrt(4n)).toBe(2n);
		expect(isqrt(10n ** 36n / 2n)).toBe(707_106_781_186_547_524n);
		expect(isqrt(2n * 10n ** 36n)).toBe(1_414_213_562_373_095_048n);
	});
	it("parses decimals", () => {
		expect(parseDecimal("58000")).toEqual({ num: 58000n, scale: 1n });
		expect(parseDecimal("0.5")).toEqual({ num: 5n, scale: 10n });
		expect(() => parseDecimal("1e5")).toThrow();
	});
	it("reproduces the test fixture: 18-dec pair, base is tokenB, 0.5 B/A ⇔ 2 A per B", () => {
		// quotePerBase = 2 (A per B) → priceBperA = 0.5 → sqrt = 0.7071e18
		expect(
			sqrtPriceX18({ quotePerBase: "2", baseDecimals: 18, quoteDecimals: 18, baseIsTokenB: true }),
		).toBe(707_106_781_186_547_524n);
		expect(
			sqrtPriceX18({
				quotePerBase: "0.5",
				baseDecimals: 18,
				quoteDecimals: 18,
				baseIsTokenB: true,
			}),
		).toBe(1_414_213_562_373_095_048n);
	});
	it("rejects a zero price", () => {
		expect(() =>
			sqrtPriceX18({ quotePerBase: "0", baseDecimals: 8, quoteDecimals: 6, baseIsTokenB: true }),
		).toThrow(/positive/);
	});
	it("when the base is tokenA, priceBperA is quote per base and the range keeps its order", () => {
		expect(
			sqrtPriceX18({ quotePerBase: "2", baseDecimals: 18, quoteDecimals: 18, baseIsTokenB: false }),
		).toBe(1_414_213_562_373_095_048n);
		const r = rangeToSqrtBounds({
			priceMin: "0.5",
			priceMax: "2",
			baseDecimals: 18,
			quoteDecimals: 18,
			baseIsTokenB: false,
		});
		expect(r).toEqual({
			sqrtPriceMin: 707_106_781_186_547_524n,
			sqrtPriceMax: 1_414_213_562_373_095_048n,
		});
	});
	it("orders a buy range for the VM: 58k–62k USDC/BTC (tUSDC 6 dec is tokenA, tWBTC 8 dec is tokenB)", () => {
		const { sqrtPriceMin, sqrtPriceMax } = rangeToSqrtBounds({
			priceMin: "58000",
			priceMax: "62000",
			baseDecimals: 8,
			quoteDecimals: 6,
			baseIsTokenB: true,
		});
		// priceBperA = 1e8 / (P * 1e6) = 100 / P. At 62k → 1.6129e-3, at 58k → 1.7241e-3.
		expect(sqrtPriceMin).toBe(isqrt((100n * 10n ** 36n) / 62000n));
		expect(sqrtPriceMax).toBe(isqrt((100n * 10n ** 36n) / 58000n));
		expect(sqrtPriceMin < sqrtPriceMax).toBe(true);
	});
	it("sortPair puts the lower address first", () => {
		const usdc = "0x274aaB610937e018310cCedC0b05B543b75557AB";
		const wbtc = "0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC";
		expect(sortPair(wbtc, usdc)).toEqual({ tokenA: usdc, tokenB: wbtc });
		expect(sortPair(usdc, wbtc)).toEqual({ tokenA: usdc, tokenB: wbtc });
	});
});
