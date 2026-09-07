import { describe, expect, it } from "vitest";
import { dragRange, priceStep } from "../src/market";

describe("dragging a range on the chart", () => {
	it("snaps to a step two orders of magnitude under the price, never finer than a cent", () => {
		expect(priceStep(80_000)).toBe(100);
		expect(priceStep(2_500)).toBe(10);
		expect(priceStep(62_000)).toBe(100);
		expect(priceStep(0.5)).toBe(0.01);
		expect(priceStep(0)).toBe(0.01);
	});

	it("moves the whole band by the body, keeping its width and snapping both edges", () => {
		expect(dragRange({ min: 58_000, max: 62_000 }, "body", 10_049)).toEqual({
			min: 68_000,
			max: 72_000,
		});
		expect(dragRange({ min: 2_200, max: 2_400 }, "body", -103)).toEqual({ min: 2_100, max: 2_300 });
	});

	it("never pushes the band below one step, keeping its width", () => {
		expect(dragRange({ min: 58_000, max: 62_000 }, "body", -70_000)).toEqual({
			min: 100,
			max: 4_100,
		});
	});

	it("resizes one edge and stops it one step short of the other", () => {
		expect(dragRange({ min: 58_000, max: 62_000 }, "min", 1_000)).toEqual({
			min: 59_000,
			max: 62_000,
		});
		expect(dragRange({ min: 58_000, max: 62_000 }, "min", 9_000)).toEqual({
			min: 61_900,
			max: 62_000,
		});
		expect(dragRange({ min: 58_000, max: 62_000 }, "max", -9_000)).toEqual({
			min: 58_000,
			max: 58_100,
		});
		expect(dragRange({ min: 58_000, max: 62_000 }, "max", 550)).toEqual({
			min: 58_000,
			max: 62_600,
		});
	});

	it("keeps the low edge above zero", () => {
		expect(dragRange({ min: 500, max: 62_000 }, "min", -900)).toEqual({ min: 100, max: 62_000 });
	});
});
