import { describe, expect, it } from "vitest";
import { convertedFraction, deriveState, isInRange, PositionParams } from "../src/position";

const base = {
	exists: true,
	now: 1_000,
	deadline: 2_000,
	amountIn: 1_000n,
	balanceIn: 1_000n,
	price: 100,
	priceMin: 50,
	priceMax: 60,
};

describe("deriveState (05 §6)", () => {
	it("is closed when the name or strategy is gone, whatever else is true", () => {
		expect(deriveState({ ...base, exists: false, now: 5_000, balanceIn: 0n })).toBe("closed");
	});
	it("is expired past the deadline even if nothing converted", () => {
		expect(deriveState({ ...base, now: 2_001 })).toBe("expired");
	});
	it("is completed when nothing of tokenIn remains", () => {
		expect(deriveState({ ...base, balanceIn: 0n })).toBe("completed");
	});
	it("is working when partially converted, even with price outside the range", () => {
		expect(deriveState({ ...base, balanceIn: 600n })).toBe("working");
	});
	it("is working when price is inside the range and nothing converted yet", () => {
		expect(deriveState({ ...base, price: 55 })).toBe("working");
	});
	it("is waiting when untouched and out of range", () => {
		expect(deriveState(base)).toBe("waiting");
	});
});

describe("convertedFraction", () => {
	it("is 0 when nothing was committed", () => {
		expect(convertedFraction(0n, 0n)).toBe(0);
	});
	it("is 0 when the balance is untouched", () => {
		expect(convertedFraction(1_000n, 1_000n)).toBe(0);
	});
	it("clamps a balance above the committed amount to 0 converted", () => {
		expect(convertedFraction(1_500n, 1_000n)).toBe(0);
	});
	it("is exact on large values", () => {
		expect(convertedFraction(25n * 10n ** 18n, 100n * 10n ** 18n)).toBe(0.75);
	});
});

describe("isInRange", () => {
	it("includes both bounds", () => {
		expect(isInRange(50, 50, 60)).toBe(true);
		expect(isInRange(60, 50, 60)).toBe(true);
		expect(isInRange(61, 50, 60)).toBe(false);
	});
});

describe("PositionParams", () => {
	const valid = {
		label: "btc-dip",
		side: "buy",
		priceMin: "58000",
		priceMax: "62000",
		amountIn: "1000000000",
		feeBps: 30,
		deadline: 1_800_000_000,
	};
	it("accepts a well-formed position", () => {
		expect(PositionParams.parse(valid)).toEqual(valid);
	});
	it("rejects a label that would not be a valid ENS label", () => {
		expect(() => PositionParams.parse({ ...valid, label: "BTC Dip" })).toThrow();
	});
	it("rejects an inverted range", () => {
		expect(() => PositionParams.parse({ ...valid, priceMin: "62000", priceMax: "58000" })).toThrow(
			/priceMin must be strictly below priceMax/,
		);
	});
});
