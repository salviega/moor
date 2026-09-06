import { describe, expect, it } from "vitest";
import { chainlinkSepolia } from "../src/addresses";
import {
	applyTick,
	bucketStart,
	type Candle,
	chainlinkFeed,
	INTERVAL_SECONDS,
	marketSymbol,
	parseBinanceKlines,
	parseBinanceTrade,
	parseCoinbaseCandles,
	parseCoinbaseTicker,
} from "../src/market";

const c = (time: number, o: number, h: number, l: number, cl: number): Candle => ({
	time,
	open: o,
	high: h,
	low: l,
	close: cl,
});

describe("market symbols and feeds", () => {
	it("names each asset the way each venue spells it", () => {
		expect(marketSymbol("btc", "binance")).toBe("BTCUSDT");
		expect(marketSymbol("eth", "binance")).toBe("ETHUSDT");
		expect(marketSymbol("btc", "coinbase")).toBe("BTC-USD");
		expect(marketSymbol("eth", "coinbase")).toBe("ETH-USD");
	});

	it("maps each asset to its own Chainlink feed — an ETH position never reads BTC", () => {
		expect(chainlinkFeed("btc")).toBe(chainlinkSepolia.btcUsd);
		expect(chainlinkFeed("eth")).toBe(chainlinkSepolia.ethUsd);
		expect(chainlinkSepolia.ethUsd).toBe("0x694AA1769357215DE4FAC081bf1f309aDC325306");
	});

	it("knows the length of every interval it offers", () => {
		expect(INTERVAL_SECONDS).toEqual({ "1m": 60, "15m": 900, "1h": 3600, "1d": 86400 });
		expect(bucketStart(1_788_735_521, "1m")).toBe(1_788_735_480);
		expect(bucketStart(1_788_735_521, "1h")).toBe(1_788_735_600 - 3600);
	});
});

describe("parsing what the venues send", () => {
	it("reads Binance klines: ms open time, string OHLC, ascending", () => {
		const raw = [
			[
				1788735420000,
				"80093.38",
				"80093.79",
				"80019.76",
				"80019.76",
				"19.95",
				1788735479999,
				"x",
				1,
				"a",
				"b",
				"0",
			],
			[
				1788735480000,
				"80019.76",
				"80060.00",
				"80000.00",
				"80052.39",
				"12.00",
				1788735539999,
				"x",
				1,
				"a",
				"b",
				"0",
			],
		];
		expect(parseBinanceKlines(raw)).toEqual([
			c(1788735420, 80093.38, 80093.79, 80019.76, 80019.76),
			c(1788735480, 80019.76, 80060, 80000, 80052.39),
		]);
	});

	it("reads Coinbase candles: seconds, [time, low, high, open, close, volume], newest first — and sorts them oldest first", () => {
		const raw = [
			[1788735180, 80021.64, 80031.09, 80021.64, 80031.09, 0.43],
			[1788735120, 79993.06, 80035.55, 80002.76, 80021.64, 1.08],
		];
		expect(parseCoinbaseCandles(raw)).toEqual([
			c(1788735120, 80002.76, 80035.55, 79993.06, 80021.64),
			c(1788735180, 80021.64, 80031.09, 80021.64, 80031.09),
		]);
	});

	it("rejects a payload that is not what it claims to be — the venue is a trust boundary", () => {
		expect(() => parseBinanceKlines({ code: -1121, msg: "Invalid symbol." })).toThrow();
		expect(() => parseBinanceKlines([[1, "a", "b"]])).toThrow();
		expect(() => parseCoinbaseCandles({ message: "NotFound" })).toThrow();
		expect(() => parseCoinbaseCandles([[1, 2]])).toThrow();
	});

	it("turns a Binance trade into a tick and ignores every other message", () => {
		expect(
			parseBinanceTrade({ e: "trade", s: "BTCUSDT", p: "80052.39000000", T: 1788735521873 }),
		).toEqual({ price: 80052.39, time: 1788735521.873 });
		expect(parseBinanceTrade({ e: "kline" })).toBeNull();
		expect(parseBinanceTrade("not json at all")).toBeNull();
		expect(parseBinanceTrade({ e: "trade", p: "nope", T: 1 })).toBeNull();
	});

	it("turns a Coinbase ticker into a tick and ignores subscriptions and heartbeats", () => {
		expect(
			parseCoinbaseTicker({ type: "ticker", price: "80031.09", time: "2026-09-06T04:18:41.874Z" }),
		).toEqual({ price: 80031.09, time: Date.parse("2026-09-06T04:18:41.874Z") / 1000 });
		expect(parseCoinbaseTicker({ type: "subscriptions", channels: [] })).toBeNull();
		expect(parseCoinbaseTicker({ type: "heartbeat" })).toBeNull();
		expect(
			parseCoinbaseTicker({ type: "ticker", price: "80031.09", time: "yesterday" }),
		).toBeNull();
	});
});

describe("applying a tick to the candles", () => {
	const base = [c(60, 10, 12, 9, 11), c(120, 11, 11, 11, 11)];

	it("updates the current candle's high, low and close inside the same bucket", () => {
		const r = applyTick(base, { price: 13, time: 150 }, "1m");
		expect(r.changed).toEqual(c(120, 11, 13, 11, 13));
		expect(r.candles).toHaveLength(2);
		expect(r.candles[1]).toEqual(c(120, 11, 13, 11, 13));
		expect(base[1]).toEqual(c(120, 11, 11, 11, 11)); // never mutates what it was given

		const r2 = applyTick(r.candles, { price: 9.5, time: 170 }, "1m");
		expect(r2.changed).toEqual(c(120, 11, 13, 9.5, 9.5));
	});

	it("opens a new candle at the tick's price when the bucket rolls over", () => {
		const r = applyTick(base, { price: 12, time: 185 }, "1m");
		expect(r.changed).toEqual(c(180, 12, 12, 12, 12));
		expect(r.candles).toHaveLength(3);
	});

	it("drops a tick older than the current candle — out-of-order frames must not rewrite history", () => {
		const r = applyTick(base, { price: 1, time: 70 }, "1m");
		expect(r.changed).toBeNull();
		expect(r.candles).toBe(base);
	});

	it("starts from nothing", () => {
		const r = applyTick([], { price: 5, time: 61 }, "1m");
		expect(r.changed).toEqual(c(60, 5, 5, 5, 5));
		expect(r.candles).toEqual([c(60, 5, 5, 5, 5)]);
	});
});
