"use client";

/**
 * The live chart: candles from a real venue, tick by tick, with the position's
 * range drawn as a band and the Chainlink price — the one the position and the
 * agent actually react to — as its own marked line. Two prices on purpose,
 * each labelled, so "the market crossed but nothing traded" has an answer.
 * With `onRangeChange` the band can be dragged: the body moves it, an edge
 * resizes it; the numbers land in the caller's fields for fine-tuning.
 * TradingView's lightweight-charts draws; @moor/core parses and folds ticks.
 */
import {
	applyTick,
	type Candle,
	dragRange,
	INTERVALS,
	type Interval,
	type MarketAsset,
	type PricePoint,
	type RangeGrab,
	type Venue,
} from "@moor/core";
import {
	type AutoscaleInfo,
	CandlestickSeries,
	ColorType,
	CrosshairMode,
	createChart,
	type IChartApi,
	type IPriceLine,
	type IPrimitivePaneRenderer,
	type IPrimitivePaneView,
	type ISeriesApi,
	type ISeriesPrimitive,
	LineStyle,
	type SeriesAttachedParameter,
	type Time,
	type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { RangeRuler } from "@/components/range-ruler";
import { ago, fmtPrice, fmtShort } from "@/lib/format";
import { fetchCandles, openTicks, type StreamStatus, venueLabel } from "@/lib/market";
import { btcDemo, demoPairs } from "@/lib/pair";

const t = {
	live: "live",
	reconnecting: "reconnecting…",
	loading: "loading market…",
	oracle: (price: string, when: string) => `Oracle · Chainlink ${price} · ${when}`,
	oracleHint: "the price your position reacts to",
	fallback:
		"Live market data is not reachable from here; showing the oracle's last 48 hours instead.",
	rangeAway: (side: "buy" | "sell", lo: string, hi: string, pct: string, dir: string) =>
		`${side === "buy" ? "buys" : "sells"} ${lo}–${hi} · ${pct} ${dir}`,
	showRange: "Show range",
	followPrice: "Follow price",
	drag: "Drag the band to move the range; its edges to widen it.",
};

type Colors = {
	text: string;
	dim: string;
	line: string;
	accent: string;
	good: string;
	bad: string;
	font: string;
};

function cssColors(): Colors {
	const s = getComputedStyle(document.documentElement);
	const v = (name: string) => s.getPropertyValue(name).trim();
	return {
		text: v("--color-text"),
		dim: v("--color-dim"),
		line: v("--color-line"),
		accent: v("--color-accent"),
		good: v("--color-good"),
		bad: v("--color-bad"),
		font: getComputedStyle(document.body).fontFamily,
	};
}

type Placement = "in" | "above" | "below";
type BandOpts = { min: number; max: number; fill: string; fit: boolean };
type Range = { min: number; max: number };

/** The library labels the axis in UTC; shifting the stamps by the local offset shows wall-clock time. */
const localTime = (t: number): UTCTimestamp =>
	(t - new Date().getTimezoneOffset() * 60) as UTCTimestamp;

/** How close to an edge, in pixels, still counts as grabbing that edge. */
const EDGE = 7;

/** The range as a band behind the candles; optionally pulls the price scale to keep it in view. */
class RangeBand implements ISeriesPrimitive<Time> {
	private param: SeriesAttachedParameter<Time> | null = null;
	private placement: Placement = "in";
	constructor(
		private opts: BandOpts,
		private onPlacement: (p: Placement) => void,
	) {}
	set(next: Partial<BandOpts>) {
		this.opts = { ...this.opts, ...next };
		this.param?.requestUpdate();
	}
	attached(p: SeriesAttachedParameter<Time>) {
		this.param = p;
	}
	detached() {
		this.param = null;
	}
	autoscaleInfo(): AutoscaleInfo | null {
		return this.opts.fit
			? { priceRange: { minValue: this.opts.min, maxValue: this.opts.max } }
			: null;
	}
	paneViews(): readonly IPrimitivePaneView[] {
		return [this.view];
	}
	private renderer: IPrimitivePaneRenderer = {
		draw: (target) => {
			const p = this.param;
			if (!p || this.opts.fill === "transparent") return;
			const top = p.series.priceToCoordinate(this.opts.max);
			const bottom = p.series.priceToCoordinate(this.opts.min);
			if (top === null || bottom === null) return;
			target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
				ctx.fillStyle = this.opts.fill;
				ctx.fillRect(0, top, mediaSize.width, Math.max(bottom - top, 2));
				const next: Placement = bottom < 0 ? "above" : top > mediaSize.height ? "below" : "in";
				if (next !== this.placement) {
					this.placement = next;
					this.onPlacement(next);
				}
			});
		},
	};
	private view: IPrimitivePaneView = { zOrder: () => "bottom", renderer: () => this.renderer };
}

export function MarketChart({
	asset,
	priceMin,
	priceMax,
	side,
	oracle,
	history = [],
	height,
	reference,
	onRangeChange,
}: {
	asset: MarketAsset;
	priceMin: number;
	priceMax: number;
	side: "buy" | "sell";
	oracle?: { price: number; updatedAt: number } | undefined;
	history?: PricePoint[];
	/** Fixed height; without it the chart fills its flex parent. */
	height?: number;
	/** A second, fainter band: the range as it is on chain while a new one is being drawn. */
	reference?: Range | undefined;
	/** Makes the band draggable; called with snapped numbers while it moves. */
	onRangeChange?: ((min: number, max: number) => void) | undefined;
}) {
	const box = useRef<HTMLDivElement>(null);
	const chart = useRef<IChartApi | null>(null);
	const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const band = useRef<RangeBand | null>(null);
	const refBand = useRef<RangeBand | null>(null);
	const oracleLine = useRef<IPriceLine | null>(null);
	const colors = useRef<Colors | null>(null);
	const candles = useRef<Candle[]>([]);
	const range = useRef<Range>({ min: priceMin, max: priceMax });
	const onRange = useRef(onRangeChange);
	const drag = useRef<{ grab: RangeGrab; startY: number; start: Range } | null>(null);
	const overlay = useRef<HTMLDivElement>(null);
	const raf = useRef(0);
	const [interval, setInterval_] = useState<Interval>("1m");
	const [status, setStatus] = useState<StreamStatus | "loading" | "error">("loading");
	const [venue, setVenue] = useState<Venue>("binance");
	const [last, setLast] = useState<number | null>(null);
	const [placement, setPlacement] = useState<Placement>("in");
	// The range is the point of the chart: keep it in view by default; "Follow price" zooms into the candles.
	const [fit, setFit] = useState(true);
	const [axes, setAxes] = useState({ right: 0, bottom: 0 });
	range.current = { min: priceMin, max: priceMax };
	onRange.current = onRangeChange;

	/** Which part of the band is under a pane-relative y, if any. */
	const zoneAt = (y: number): RangeGrab | null => {
		const s = series.current;
		if (!s || !onRange.current) return null;
		const top = s.priceToCoordinate(range.current.max);
		const bottom = s.priceToCoordinate(range.current.min);
		if (top === null || bottom === null) return null;
		if (Math.abs(y - top) <= EDGE) return "max";
		if (Math.abs(y - bottom) <= EDGE) return "min";
		return y > top && y < bottom ? "body" : null;
	};
	/** Arms the overlay imperatively — through state it would miss a press that follows the hover by a frame. */
	const arm = (zone: RangeGrab | null, dragging = false) => {
		const el = overlay.current;
		if (!el) return;
		el.style.pointerEvents = zone || dragging ? "auto" : "none";
		el.style.cursor = dragging ? "grabbing" : zone === "body" ? "grab" : "ns-resize";
	};

	// The chart itself, once.
	useEffect(() => {
		const el = box.current;
		if (!el) return;
		const c = cssColors();
		colors.current = c;
		const ch = createChart(el, {
			autoSize: true,
			layout: {
				background: { type: ColorType.Solid, color: "transparent" },
				textColor: c.dim,
				fontFamily: c.font,
				fontSize: 11,
			},
			grid: { vertLines: { color: c.line }, horzLines: { color: c.line } },
			crosshair: { mode: CrosshairMode.Normal },
			rightPriceScale: { borderColor: c.line, scaleMargins: { top: 0.08, bottom: 0.08 } },
			timeScale: { borderColor: c.line, timeVisible: true, secondsVisible: false, rightOffset: 4 },
		});
		const s = ch.addSeries(CandlestickSeries, {
			upColor: c.good,
			downColor: c.bad,
			borderVisible: false,
			wickUpColor: c.good,
			wickDownColor: c.bad,
			priceFormat: { type: "price", precision: 2, minMove: 0.01 },
		});
		// The ranges and the oracle are applied by the effects below, on mount and on every change.
		const r = new RangeBand({ min: 0, max: 0, fill: "transparent", fit: false }, () => {});
		const b = new RangeBand({ min: 0, max: 0, fill: `${c.accent}33`, fit: false }, setPlacement);
		s.attachPrimitive(r);
		s.attachPrimitive(b);
		// Hovering the band arms the drag overlay; anywhere else the chart keeps the pointer.
		ch.subscribeCrosshairMove((param) => {
			if (drag.current) return;
			const y = param.point?.y;
			arm(y === undefined ? null : zoneAt(y));
			setAxes((a) => {
				const right = ch.priceScale("right").width();
				const bottom = ch.timeScale().height();
				return a.right === right && a.bottom === bottom ? a : { right, bottom };
			});
		});
		chart.current = ch;
		series.current = s;
		band.current = b;
		refBand.current = r;
		return () => {
			ch.remove();
			chart.current = null;
			series.current = null;
			band.current = null;
			refBand.current = null;
			oracleLine.current = null;
		};
	}, []);

	// The range and the oracle, whenever they change.
	useEffect(() => {
		band.current?.set({ min: priceMin, max: priceMax, fit });
		const s = series.current;
		const c = colors.current;
		if (!s || !c) return;
		// One labelled edge: the price the order starts working at. The library only draws the
		// in-pane title when the axis label is on, so both show.
		const edge = s.createPriceLine({
			price: side === "buy" ? priceMax : priceMin,
			color: c.accent,
			lineWidth: 1,
			lineStyle: LineStyle.Solid,
			axisLabelVisible: true,
			title: `${side === "buy" ? "buys" : "sells"} ${fmtShort(priceMin)}–${fmtShort(priceMax)}`,
		});
		return () => s.removePriceLine(edge);
	}, [priceMin, priceMax, side, fit]);
	useEffect(() => {
		const c = colors.current;
		refBand.current?.set({
			min: reference?.min ?? 0,
			max: reference?.max ?? 0,
			fill: reference && c ? `${c.accent}14` : "transparent",
			fit: !!reference && fit,
		});
	}, [reference, fit]);
	useEffect(() => {
		const s = series.current;
		const c = colors.current;
		if (!s || !c) return;
		if (!oracle) {
			if (oracleLine.current) s.removePriceLine(oracleLine.current);
			oracleLine.current = null;
			return;
		}
		const opts = {
			price: oracle.price,
			color: c.text,
			lineWidth: 1 as const,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "oracle",
		};
		if (oracleLine.current) oracleLine.current.applyOptions(opts);
		else oracleLine.current = s.createPriceLine(opts);
	}, [oracle]);

	// Candles, then the stream — again for every asset or interval.
	useEffect(() => {
		const s = series.current;
		const ch = chart.current;
		if (!s || !ch) return;
		const abort = new AbortController();
		let stream: { close(): void } | null = null;
		let pending: number | null = null;
		let flush: ReturnType<typeof setTimeout> | undefined;
		setStatus("loading");
		setLast(null);
		candles.current = [];
		s.setData([]);
		fetchCandles(asset, interval, "binance", abort.signal)
			.then(({ candles: initial, venue: v }) => {
				if (abort.signal.aborted) return;
				candles.current = initial;
				s.setData(initial.map((k) => ({ ...k, time: localTime(k.time) })));
				ch.timeScale().scrollToRealTime();
				setVenue(v);
				setLast(initial.at(-1)?.close ?? null);
				stream = openTicks(asset, v, {
					tick(tick) {
						const r = applyTick(candles.current, tick, interval);
						if (!r.changed) return;
						candles.current = r.candles;
						s.update({ ...r.changed, time: localTime(r.changed.time) });
						// The header's number moves at most a few times a second, not per trade.
						pending = tick.price;
						if (!flush)
							flush = setTimeout(() => {
								flush = undefined;
								if (pending !== null) setLast(pending);
							}, 250);
					},
					status(st, at) {
						setStatus(st);
						setVenue(at);
					},
				});
			})
			.catch(() => {
				if (!abort.signal.aborted) setStatus("error");
			});
		return () => {
			abort.abort();
			stream?.close();
			clearTimeout(flush);
		};
	}, [asset, interval]);

	// Dragging: the overlay only exists while the pointer is over the band, so the chart keeps
	// its own scroll and zoom everywhere else. The price scale is frozen for the duration.
	const paneY = (e: React.PointerEvent<HTMLDivElement>) =>
		e.clientY - e.currentTarget.getBoundingClientRect().top;
	/** Where the band lands for a pointer at pane-relative `y`, given where the drag began. */
	const dragged = (d: { grab: RangeGrab; startY: number; start: Range }, y: number) => {
		const s = series.current;
		if (!s) return null;
		const p0 = s.coordinateToPrice(d.startY);
		const p1 = s.coordinateToPrice(y);
		if (p0 === null || p1 === null) return null;
		return dragRange(d.start, d.grab, p1 - p0);
	};
	const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
		const ch = chart.current;
		const y = paneY(e);
		const grab = zoneAt(y);
		if (!ch || !grab) return;
		drag.current = { grab, startY: y, start: { ...range.current } };
		e.currentTarget.setPointerCapture(e.pointerId);
		ch.priceScale("right").applyOptions({ autoScale: false });
		ch.applyOptions({ handleScroll: false, handleScale: false });
		arm(grab, true);
	};
	const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const y = paneY(e);
		const d = drag.current;
		if (!d) {
			arm(zoneAt(y));
			return;
		}
		const next = dragged(d, y);
		if (!next) return;
		cancelAnimationFrame(raf.current);
		raf.current = requestAnimationFrame(() => onRange.current?.(next.min, next.max));
	};
	const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
		const d = drag.current;
		if (!d) return;
		// The release position is the one that counts, whether or not a move preceded it.
		const next = dragged(d, paneY(e));
		cancelAnimationFrame(raf.current);
		if (next) onRange.current?.(next.min, next.max);
		drag.current = null;
		const ch = chart.current;
		ch?.priceScale("right").applyOptions({ autoScale: true });
		ch?.applyOptions({ handleScroll: true, handleScale: true });
		arm(zoneAt(paneY(e)));
	};

	if (status === "error")
		return (
			<div className="flex flex-col gap-2">
				<RangeRuler
					priceMin={priceMin}
					priceMax={priceMax}
					price={oracle?.price}
					history={history}
					side={side}
				/>
				<p className="text-dim text-xs">{t.fallback}</p>
			</div>
		);

	const symbol = `${asset.toUpperCase()} / USD`;
	const icon = (demoPairs.find((d) => d.id === asset) ?? btcDemo).icon;
	const ref = last ?? oracle?.price;
	const away =
		ref && placement !== "in"
			? placement === "below"
				? `${((ref / priceMax - 1) * 100).toFixed(0)}%`
				: `${((1 - ref / priceMin) * 100).toFixed(0)}%`
			: null;

	return (
		<div className={`flex min-h-0 flex-col gap-2 ${height ? "" : "h-full"}`}>
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<div className="flex items-center gap-2">
					<img
						src={icon}
						alt=""
						width={18}
						height={18}
						className="h-[18px] w-[18px] rounded-full"
					/>
					<span className="text-muted text-sm">{symbol}</span>
					{last !== null ? (
						<span className="num text-text text-xl">{fmtPrice(last)}</span>
					) : (
						<span className="skeleton inline-block h-6 w-24" />
					)}
					<span className="flex items-center gap-1.5 text-dim text-xs">
						<span
							aria-hidden
							className={`inline-block h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-good" : "bg-dim"}`}
						/>
						{status === "live"
							? `${venueLabel[venue]} · ${t.live}`
							: status === "loading"
								? t.loading
								: t.reconnecting}
					</span>
				</div>
				<div className="flex items-center gap-1" role="radiogroup" aria-label="Candle interval">
					{INTERVALS.map((i) => (
						<button
							key={i}
							type="button"
							role="radio"
							aria-checked={interval === i}
							onClick={() => setInterval_(i)}
							className={`num min-h-8 rounded-sm px-2 text-xs ${interval === i ? "bg-ink-2 text-text" : "text-dim hover:text-text"}`}
						>
							{i}
						</button>
					))}
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-dim text-xs">
				<span>
					{oracle ? (
						<>
							<span className="num text-muted">
								{t.oracle(fmtPrice(oracle.price), ago(oracle.updatedAt))}
							</span>{" "}
							— {t.oracleHint}
						</>
					) : null}
				</span>
				{away ? (
					<span className="flex items-center gap-2">
						<span className="num">
							{placement === "below" ? "▼" : "▲"}{" "}
							{t.rangeAway(
								side,
								fmtShort(priceMin),
								fmtShort(priceMax),
								away,
								placement === "below" ? "below" : "above",
							)}
						</span>
						<button
							type="button"
							className="min-h-8 text-accent underline"
							onClick={() => setFit(true)}
						>
							{t.showRange}
						</button>
					</span>
				) : fit ? (
					<button
						type="button"
						className="min-h-8 text-accent underline"
						onClick={() => setFit(false)}
					>
						{t.followPrice}
					</button>
				) : null}
			</div>
			<div
				className={height ? "relative w-full" : "relative min-h-[200px] w-full flex-1"}
				style={height ? { height } : undefined}
			>
				<div
					ref={box}
					role="img"
					aria-label={`${symbol} candles, ${interval}; ${side === "buy" ? "buys" : "sells"} between ${fmtShort(priceMin)} and ${fmtShort(priceMax)}`}
					className="absolute inset-0"
				/>
				{onRangeChange ? (
					<div
						aria-hidden
						onPointerDown={onDown}
						onPointerMove={onMove}
						onPointerUp={onUp}
						onPointerCancel={onUp}
						onPointerLeave={() => {
							if (!drag.current) arm(null);
						}}
						ref={overlay}
						className="absolute top-0 left-0 z-10"
						style={{
							right: axes.right,
							bottom: axes.bottom,
							pointerEvents: "none",
							touchAction: "none",
						}}
					/>
				) : null}
			</div>
			{onRangeChange ? <p className="text-dim text-xs">{t.drag}</p> : null}
		</div>
	);
}
