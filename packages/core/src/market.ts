/**
 * Live market data for the chart: what a real venue says the asset trades
 * at, tick by tick. It is context, never the trigger — a position and the
 * agent only ever react to the Chainlink feed, which is why `chainlinkFeed`
 * lives next to the venue parsers: the chart shows both and says which is
 * which. Venues are a trust boundary; every payload crosses a Zod schema.
 */
import type { Address } from "viem";
import { z } from "zod";
import { chainlinkSepolia } from "./addresses";

export type MarketAsset = "btc" | "eth";
export type Venue = "binance" | "coinbase";
export type Interval = "1m" | "15m" | "1h" | "1d";

export const INTERVALS: readonly Interval[] = ["1m", "15m", "1h", "1d"];
export const INTERVAL_SECONDS: Record<Interval, number> = {
	"1m": 60,
	"15m": 900,
	"1h": 3600,
	"1d": 86400,
};

/** One candle; `time` is the bucket's start, in seconds. */
export interface Candle {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
}

export interface Tick {
	price: number;
	time: number;
}

export function marketSymbol(asset: MarketAsset, venue: Venue): string {
	const a = asset.toUpperCase();
	return venue === "binance" ? `${a}USDT` : `${a}-USD`;
}

/** The oracle a position of this asset is actually judged by. */
export function chainlinkFeed(asset: MarketAsset): Address {
	return asset === "eth" ? chainlinkSepolia.ethUsd : chainlinkSepolia.btcUsd;
}

export function bucketStart(time: number, interval: Interval): number {
	const s = INTERVAL_SECONDS[interval];
	return Math.floor(time / s) * s;
}

const num = z.coerce.number().refine(Number.isFinite, "not a finite number");

// Binance: [openTime ms, open, high, low, close, volume, closeTime, …], oldest first.
const binanceKline = z.tuple([z.number(), num, num, num, num]).rest(z.unknown());
export function parseBinanceKlines(raw: unknown): Candle[] {
	return z
		.array(binanceKline)
		.parse(raw)
		.map(([t, open, high, low, close]) => ({ time: t / 1000, open, high, low, close }));
}

// Coinbase Exchange: [time s, low, high, open, close, volume], newest first.
const coinbaseCandle = z.tuple([z.number(), num, num, num, num]).rest(z.unknown());
export function parseCoinbaseCandles(raw: unknown): Candle[] {
	return z
		.array(coinbaseCandle)
		.parse(raw)
		.map(([time, low, high, open, close]) => ({ time, open, high, low, close }))
		.sort((a, b) => a.time - b.time);
}

const binanceTrade = z.object({ e: z.literal("trade"), p: num, T: z.number() });
export function parseBinanceTrade(raw: unknown): Tick | null {
	const r = binanceTrade.safeParse(raw);
	return r.success ? { price: r.data.p, time: r.data.T / 1000 } : null;
}

const coinbaseTicker = z.object({ type: z.literal("ticker"), price: num, time: z.string() });
export function parseCoinbaseTicker(raw: unknown): Tick | null {
	const r = coinbaseTicker.safeParse(raw);
	if (!r.success) return null;
	const ms = Date.parse(r.data.time);
	return Number.isFinite(ms) ? { price: r.data.price, time: ms / 1000 } : null;
}

/**
 * Fold one tick into the candles: extend the current candle, open the next
 * one when the bucket rolls over, or drop the tick if it is older than the
 * current candle (frames arrive out of order; history is not rewritten).
 * Never mutates its input; `changed` is the candle the chart must redraw.
 */
export function applyTick(
	candles: Candle[],
	tick: Tick,
	interval: Interval,
): { candles: Candle[]; changed: Candle | null } {
	const time = bucketStart(tick.time, interval);
	const last = candles.at(-1);
	if (last && time < last.time) return { candles, changed: null };
	if (last && time === last.time) {
		const changed: Candle = {
			...last,
			high: Math.max(last.high, tick.price),
			low: Math.min(last.low, tick.price),
			close: tick.price,
		};
		return { candles: [...candles.slice(0, -1), changed], changed };
	}
	const changed: Candle = {
		time,
		open: tick.price,
		high: tick.price,
		low: tick.price,
		close: tick.price,
	};
	return { candles: [...candles, changed], changed };
}

/** Snap step for dragging a range on the chart: two orders of magnitude under the price, never under a cent. */
export function priceStep(price: number): number {
	if (!(price > 0)) return 0.01;
	return Math.max(0.01, 10 ** (Math.floor(Math.log10(price)) - 2));
}

export type RangeGrab = "body" | "min" | "max";

/**
 * Where a dragged band ends up: the body moves both edges keeping the width,
 * an edge moves alone and stops one step short of the other. Snapped to
 * `priceStep`, never below one step.
 */
export function dragRange(
	range: { min: number; max: number },
	grab: RangeGrab,
	delta: number,
): { min: number; max: number } {
	const step = priceStep(range.max);
	const snap = (v: number) => Number((Math.round(v / step) * step).toFixed(8));
	const d = snap(delta);
	if (grab === "body") {
		const min = Math.max(step, snap(range.min + d));
		return { min, max: snap(min + (range.max - range.min)) };
	}
	if (grab === "min") {
		return {
			min: Math.min(Math.max(step, snap(range.min + d)), snap(range.max - step)),
			max: range.max,
		};
	}
	return { min: range.min, max: Math.max(snap(range.max + d), snap(range.min + step)) };
}
