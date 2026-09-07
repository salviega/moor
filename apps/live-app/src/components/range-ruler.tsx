"use client";

/**
 * The one picture a holder needs: where the price is, where the range is, and
 * where the price has been. Pure SVG, no library, legible at 390px. `compact`
 * is the row version; the full one carries labels.
 */
import type { PricePoint } from "@moor/core";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ago, fmtShort } from "@/lib/format";

export function RangeRuler({
	priceMin,
	priceMax,
	price,
	history = [],
	side,
	compact = false,
}: {
	priceMin: number;
	priceMax: number;
	price?: number | undefined;
	history?: PricePoint[];
	side: "buy" | "sell";
	compact?: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [W, setW] = useState(600);
	useEffect(() => {
		// Measured from the wrapper, never from the SVG (which sizes to it): no observer, no feedback loop.
		const measure = () => {
			const w = ref.current?.getBoundingClientRect().width ?? 0;
			if (w > 0) setW((prev) => (Math.abs(prev - w) > 4 ? Math.round(w) : prev));
		};
		measure();
		let raf = 0;
		const onResize = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(measure);
		};
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
			cancelAnimationFrame(raf);
		};
	}, []);
	if (!compact)
		return (
			<PriceChart
				W={W}
				priceMin={priceMin}
				priceMax={priceMax}
				price={price}
				history={history}
				side={side}
				wrap={ref}
			/>
		);
	const H = 28;
	const padX = 4;
	const values = [priceMin, priceMax, ...(price ? [price] : []), ...history.map((h) => h.price)];
	const lo = Math.min(...values);
	const hi = Math.max(...values);
	const span = (hi - lo || 1) * 1.08;
	const start = lo - (hi - lo || 1) * 0.04;
	const x = (v: number) => padX + ((v - start) / span) * (W - 2 * padX);
	const yMid = H / 2;
	const inRange = price !== undefined && price >= priceMin && price <= priceMax;
	const label = `${side === "buy" ? "Buys" : "Sells"} between ${fmtShort(priceMin)} and ${fmtShort(priceMax)}; price ${price ? fmtShort(price) : "unknown"}${inRange ? ", inside the range" : ""}`;
	return (
		<div ref={ref} className="w-full">
			<svg
				viewBox={`0 0 ${W} ${H}`}
				width="100%"
				height={H}
				role="img"
				aria-label={label}
				className="block max-w-full"
			>
				<title>{label}</title>
				<line
					x1={padX}
					x2={W - padX}
					y1={yMid}
					y2={yMid}
					stroke="var(--color-line-strong)"
					strokeWidth="1"
				/>
				<rect
					x={x(priceMin)}
					y={yMid - 5}
					width={Math.max(x(priceMax) - x(priceMin), 2)}
					height={10}
					fill="var(--color-accent)"
					fillOpacity={inRange ? 0.45 : 0.22}
				/>
				{price !== undefined ? (
					<line
						x1={x(price)}
						x2={x(price)}
						y1={yMid - 9}
						y2={yMid + 9}
						stroke="var(--color-text)"
						strokeWidth="1.5"
					/>
				) : null}
			</svg>
		</div>
	);
}

/** Time on x (last 48 h), price on y, the range as a band: where the price has been against where the order works. */
function PriceChart({
	W,
	priceMin,
	priceMax,
	price,
	history,
	side,
	wrap,
}: {
	W: number;
	priceMin: number;
	priceMax: number;
	price: number | undefined;
	history: PricePoint[];
	side: "buy" | "sell";
	wrap: React.RefObject<HTMLDivElement | null>;
}) {
	const H = 132;
	const padL = 52;
	const padR = 56;
	const padT = 10;
	const padB = 18;
	const svgRef = useRef<SVGSVGElement>(null);
	const [hover, setHover] = useState<number | null>(null);
	const pts = history.length > 1 ? history : price ? [{ price, updatedAt: Date.now() / 1000 }] : [];
	const values = [priceMin, priceMax, ...pts.map((p) => p.price), ...(price ? [price] : [])];
	const lo = Math.min(...values);
	const hi = Math.max(...values);
	const pad = (hi - lo || 1) * 0.08;
	const y = (v: number) =>
		padT + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad || 1)) * (H - padT - padB);
	const t0 = pts[0]?.updatedAt ?? 0;
	const t1 = pts.at(-1)?.updatedAt ?? 1;
	const x = (t: number) => padL + ((t - t0) / (t1 - t0 || 1)) * (W - padL - padR);
	const path = pts
		.map((p, i) => `${i ? "L" : "M"}${x(p.updatedAt).toFixed(1)},${y(p.price).toFixed(1)}`)
		.join(" ");
	const inRange = price !== undefined && price >= priceMin && price <= priceMax;
	const hours = pts.length > 1 ? Math.round((t1 - t0) / 3600) : 0;
	const label = `${side === "buy" ? "Buys" : "Sells"} between ${fmtShort(priceMin)} and ${fmtShort(priceMax)}; price ${price ? fmtShort(price) : "unknown"}${inRange ? ", inside the range" : ""}; last ${hours} hours shown`;

	const onHover = (e: React.PointerEvent<SVGSVGElement>) => {
		if (pts.length === 0) return;
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect || rect.width === 0) return;
		const mouseX = ((e.clientX - rect.left) / rect.width) * W;
		let best = 0;
		let bestDist = Number.POSITIVE_INFINITY;
		for (let i = 0; i < pts.length; i++) {
			const pt = pts[i];
			if (!pt) continue;
			const d = Math.abs(x(pt.updatedAt) - mouseX);
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		}
		setHover(best);
	};
	const hovered = hover !== null ? pts[hover] : undefined;
	const boxW = 78;
	const boxH = 34;
	const hx = hovered ? x(hovered.updatedAt) : 0;
	const hy = hovered ? y(hovered.price) : 0;
	const boxX = hovered ? (hx + 10 + boxW > W - 4 ? hx - 10 - boxW : hx + 10) : 0;
	const boxY = hovered ? Math.min(Math.max(hy - boxH / 2, padT), H - padB - boxH) : 0;

	return (
		<div ref={wrap} className="w-full">
			<svg
				ref={svgRef}
				viewBox={`0 0 ${W} ${H}`}
				width="100%"
				height={H}
				role="img"
				aria-label={label}
				className="block max-w-full"
				onPointerMove={onHover}
				onPointerLeave={() => setHover(null)}
			>
				<title>{label}</title>
				<rect
					x={padL}
					y={y(priceMax)}
					width={W - padL - padR}
					height={Math.max(y(priceMin) - y(priceMax), 2)}
					fill="var(--color-accent)"
					fillOpacity={inRange ? 0.32 : 0.16}
				/>
				<text
					x={padL - 6}
					y={y(priceMax) + 4}
					textAnchor="end"
					fontSize="11"
					className="num"
					fill="var(--color-muted)"
				>
					{fmtShort(priceMax)}
				</text>
				<text
					x={padL - 6}
					y={y(priceMin) + 4}
					textAnchor="end"
					fontSize="11"
					className="num"
					fill="var(--color-muted)"
				>
					{fmtShort(priceMin)}
				</text>
				<text
					x={padL - 6}
					y={y(priceMax) - 8}
					textAnchor="end"
					fontSize="10"
					fill="var(--color-dim)"
				>
					{side === "buy" ? "buys" : "sells"}
				</text>
				{path ? (
					<path
						d={path}
						fill="none"
						stroke="var(--color-text)"
						strokeWidth="1.25"
						strokeLinejoin="round"
					/>
				) : null}
				{price !== undefined ? (
					<>
						<circle
							key={price}
							className="price-pulse"
							cx={x(t1)}
							cy={y(price)}
							fill="none"
							stroke="var(--color-text)"
							strokeWidth="1"
						/>
						<circle className="price-dot" cx={x(t1)} cy={y(price)} r="3" fill="var(--color-text)" />
						<text
							x={x(t1) + 8}
							y={y(price) + 4}
							fontSize="11"
							className="num"
							fill="var(--color-text)"
						>
							{fmtShort(price)}
						</text>
					</>
				) : null}
				{hours ? (
					<text x={padL} y={H - 4} fontSize="10" fill="var(--color-dim)">
						{hours} h ago
					</text>
				) : null}
				<text x={W - padR} y={H - 4} textAnchor="end" fontSize="10" fill="var(--color-dim)">
					now
				</text>
				{hovered ? (
					<g pointerEvents="none">
						<line
							x1={hx}
							x2={hx}
							y1={padT}
							y2={H - padB}
							stroke="var(--color-line-strong)"
							strokeWidth="1"
							strokeDasharray="2 3"
						/>
						<circle cx={hx} cy={hy} r="3.5" fill="var(--color-accent)" />
						<rect
							x={boxX}
							y={boxY}
							width={boxW}
							height={boxH}
							rx="4"
							fill="var(--color-ink-2)"
							stroke="var(--color-line)"
						/>
						<text x={boxX + 8} y={boxY + 14} fontSize="11" className="num" fill="var(--color-text)">
							{fmtShort(hovered.price)}
						</text>
						<text x={boxX + 8} y={boxY + 27} fontSize="10" fill="var(--color-dim)">
							{ago(hovered.updatedAt)}
						</text>
					</g>
				) : null}
			</svg>
		</div>
	);
}
