import { formatUnits } from "viem";

/** Amount with its unit, decimals trimmed per asset: 2 for a stable, up to 6 for BTC. */
export const fmtAmount = (
	raw: bigint,
	decimals: number,
	symbol: string,
	digits = symbol.includes("BTC") ? 6 : 2,
) => {
	const n = Number(formatUnits(raw, decimals));
	return `${n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: n < 1 && n > 0 ? Math.min(digits, 4) : 0 })} ${symbol}`;
};

/** Dollar reference, secondary to the amount. `price` is USD per unit of the asset. */
export const fmtUsd = (raw: bigint, decimals: number, price: number) => {
	const n = Number(formatUnits(raw, decimals)) * price;
	return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

export const fmtPrice = (n: number) =>
	n.toLocaleString("en-US", { maximumFractionDigits: n >= 1000 ? 0 : 2 });

/** Short form for tight spaces: 79.6k, 1.2M. */
export const fmtShort = (n: number) =>
	n >= 1_000_000
		? `${(n / 1_000_000).toFixed(2)}M`
		: n >= 10_000
			? `${(n / 1000).toFixed(1)}k`
			: fmtPrice(n);

export const fmtPct = (fraction: number) =>
	`${(fraction * 100).toFixed(fraction > 0 && fraction < 0.001 ? 2 : 1)}%`;

export const fmtDate = (unix: number) =>
	new Date(unix * 1000).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

export const ago = (unix: number, now = Date.now() / 1000) => {
	const s = Math.max(0, Math.floor(now - unix));
	if (s < 90) return "just now";
	if (s < 5400) return `${Math.round(s / 60)} min ago`;
	if (s < 172800) return `${Math.round(s / 3600)} h ago`;
	return `${Math.round(s / 86400)} d ago`;
};

export const daysLeft = (unix: number, now = Date.now() / 1000) =>
	Math.max(0, Math.ceil((unix - now) / 86400));

export const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
