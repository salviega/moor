"use client";

/**
 * The venue side of the live chart: candles over REST, then every trade over
 * a WebSocket. Binance first (the tightest public stream), Coinbase when
 * Binance does not answer — it geo-blocks whole countries — and the other one
 * again if a socket keeps dropping. Parsing lives in @moor/core behind Zod;
 * this file only moves bytes and reconnects.
 */
import {
	type Candle,
	INTERVAL_SECONDS,
	type Interval,
	type MarketAsset,
	marketSymbol,
	parseBinanceKlines,
	parseBinanceTrade,
	parseCoinbaseCandles,
	parseCoinbaseTicker,
	type Tick,
	type Venue,
} from "@moor/core";

const VENUES: readonly Venue[] = ["binance", "coinbase"];
const LIMIT = 300;

const restUrl: Record<Venue, (asset: MarketAsset, interval: Interval) => string> = {
	binance: (a, i) =>
		`https://api.binance.com/api/v3/klines?symbol=${marketSymbol(a, "binance")}&interval=${i}&limit=${LIMIT}`,
	coinbase: (a, i) =>
		`https://api.exchange.coinbase.com/products/${marketSymbol(a, "coinbase")}/candles?granularity=${INTERVAL_SECONDS[i]}`,
};
const parseCandles: Record<Venue, (raw: unknown) => Candle[]> = {
	binance: parseBinanceKlines,
	coinbase: parseCoinbaseCandles,
};
const other = (v: Venue): Venue => (v === "binance" ? "coinbase" : "binance");

export async function fetchCandles(
	asset: MarketAsset,
	interval: Interval,
	prefer: Venue = "binance",
	signal?: AbortSignal,
): Promise<{ candles: Candle[]; venue: Venue }> {
	let lastError: unknown;
	for (const venue of [prefer, other(prefer)] as const) {
		try {
			const res = await fetch(restUrl[venue](asset, interval), { signal: signal ?? null });
			if (!res.ok) throw new Error(`${venue} answered ${res.status}`);
			return { candles: parseCandles[venue](await res.json()), venue };
		} catch (e) {
			if (signal?.aborted) throw e;
			lastError = e;
		}
	}
	throw lastError instanceof Error ? lastError : new Error(`no venue answered for ${asset}`);
}

export type StreamStatus = "live" | "reconnecting";

export interface TickStream {
	close(): void;
}

/** Follow trades; hands each one to `on.tick` and every connection change to `on.status`. */
export function openTicks(
	asset: MarketAsset,
	venue: Venue,
	on: { tick(t: Tick): void; status(s: StreamStatus, venue: Venue): void },
): TickStream {
	let ws: WebSocket | null = null;
	let closed = false;
	let current = venue;
	let failures = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const connect = () => {
		if (closed) return;
		const v = current;
		ws = new WebSocket(
			v === "binance"
				? `wss://stream.binance.com:9443/ws/${marketSymbol(asset, "binance").toLowerCase()}@trade`
				: "wss://ws-feed.exchange.coinbase.com",
		);
		ws.onopen = () => {
			failures = 0;
			on.status("live", v);
			if (v === "coinbase")
				ws?.send(
					JSON.stringify({
						type: "subscribe",
						product_ids: [marketSymbol(asset, "coinbase")],
						channels: ["ticker"],
					}),
				);
		};
		ws.onmessage = (m) => {
			let raw: unknown;
			try {
				raw = JSON.parse(String(m.data));
			} catch {
				return;
			}
			const tick = v === "binance" ? parseBinanceTrade(raw) : parseCoinbaseTicker(raw);
			if (tick) on.tick(tick);
		};
		ws.onerror = () => ws?.close();
		ws.onclose = () => {
			if (closed) return;
			on.status("reconnecting", v);
			failures += 1;
			// Two strikes on one venue and we try the other; the delay grows either way.
			if (failures >= 2) current = other(current);
			timer = setTimeout(connect, Math.min(1000 * 2 ** failures, 15_000));
		};
	};
	connect();

	return {
		close() {
			closed = true;
			clearTimeout(timer);
			ws?.close();
		},
	};
}

export const venueLabel: Record<Venue, string> = { binance: "Binance", coinbase: "Coinbase" };
