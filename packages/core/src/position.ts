/**
 * The product-level shape of a position (04 §3) and the state derivation
 * (05 §6). Pure functions: the Live App and the agent both call these and
 * must never reimplement them.
 */
import { z } from "zod";

export const Side = z.enum(["buy", "sell"]);
export type Side = z.infer<typeof Side>;

export const PositionState = z.enum(["waiting", "working", "completed", "expired", "closed"]);
export type PositionState = z.infer<typeof PositionState>;

export const PositionParams = z
	.object({
		label: z
			.string()
			.min(1)
			.max(63)
			.regex(/^[a-z0-9-]+$/, "lowercase letters, digits and hyphens only"),
		side: Side,
		/** Price bounds, in quote units per base unit (e.g. USDC per WBTC), as decimal strings. */
		priceMin: z.string().regex(/^\d+(\.\d+)?$/),
		priceMax: z.string().regex(/^\d+(\.\d+)?$/),
		/** Amount of tokenIn committed, in base units (wei-style), as a decimal string. */
		amountIn: z.string().regex(/^\d+$/),
		feeBps: z.number().int().min(0).max(10_000),
		/** Unix seconds. */
		deadline: z.number().int().positive(),
	})
	.refine((p) => Number(p.priceMin) < Number(p.priceMax), {
		message: "priceMin must be strictly below priceMax",
		path: ["priceMax"],
	});
export type PositionParams = z.infer<typeof PositionParams>;

export interface StateInputs {
	/** Whether the ENS subname exists and the Aqua strategy has not been docked. */
	exists: boolean;
	/** Current unix seconds. */
	now: number;
	deadline: number;
	/** Remaining balance of tokenIn in the Aqua virtual balance. */
	balanceIn: bigint;
	/** Amount of tokenIn committed at `ship`. */
	amountIn: bigint;
	/** Observed market price, quote per base. */
	price: number;
	priceMin: number;
	priceMax: number;
}

/**
 * Fraction of the committed amount already converted, in [0, 1].
 * Returns 0 when nothing was ever committed, so a fresh position is "waiting".
 */
export function convertedFraction(balanceIn: bigint, amountIn: bigint): number {
	if (amountIn <= 0n) return 0;
	const remaining = balanceIn > amountIn ? amountIn : balanceIn;
	// 1 − balIn / amount0, computed on bigints then scaled to avoid float drift on large values.
	const scaled = ((amountIn - remaining) * 1_000_000n) / amountIn;
	return Number(scaled) / 1_000_000;
}

export function isInRange(price: number, priceMin: number, priceMax: number): boolean {
	return price >= priceMin && price <= priceMax;
}

/** 05 §6, verbatim: the order of the checks is the definition. */
export function deriveState(i: StateInputs): PositionState {
	if (!i.exists) return "closed";
	if (i.now > i.deadline) return "expired";
	const converted = convertedFraction(i.balanceIn, i.amountIn);
	if (converted >= 1) return "completed";
	if (converted > 0 || isInRange(i.price, i.priceMin, i.priceMax)) return "working";
	return "waiting";
}
