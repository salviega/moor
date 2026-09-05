/**
 * Holder fees (05 §6). SwapVM's FeeFlatIn charges the taker on tokenIn before the
 * curve runs, and the whole gross amount lands in the holder's Aqua balance — the
 * fee is auto-reinvested, never separated. So fees are *derived* from what each
 * `Swapped` event reports, to within rounding:
 *
 *   gross = net + ceil(net · f / (B − f))   ⇒   net ≈ gross · (B − f) / B
 *   fee   = gross − net
 *
 * with B = 1e7 (SwapVM's fee unit). The interface calls this an estimate (04 §3).
 */
import { FEE_BPS_ONE } from "./program";

/** Fee the holder earned on one swap, from the gross tokenIn the taker paid. */
export function feeEarnedFromGrossIn(grossAmountIn: bigint, feeBps: number): bigint {
	if (grossAmountIn < 0n) throw new Error("negative amount");
	if (feeBps < 0 || feeBps >= FEE_BPS_ONE) throw new Error("feeBps out of range");
	const B = BigInt(FEE_BPS_ONE);
	const net = (grossAmountIn * (B - BigInt(feeBps))) / B;
	return grossAmountIn - net;
}

export interface SwapFill {
	/** Gross tokenIn the taker paid (`Swapped.amountIn`). */
	amountIn: bigint;
	/** tokenOut the position gave (`Swapped.amountOut`). */
	amountOut: bigint;
}

/** Totals over a position's fills: what came in, what went out, and the fee share of what came in. */
export function accrue(
	fills: readonly SwapFill[],
	feeBps: number,
): { grossIn: bigint; out: bigint; fees: bigint } {
	let grossIn = 0n;
	let out = 0n;
	let fees = 0n;
	for (const f of fills) {
		grossIn += f.amountIn;
		out += f.amountOut;
		fees += feeEarnedFromGrossIn(f.amountIn, feeBps);
	}
	return { grossIn, out, fees };
}
