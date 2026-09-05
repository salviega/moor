import { formatUnits } from "viem";

export const fmtAmount = (raw: bigint, decimals: number, symbol: string, digits = 2) => {
	const n = Number(formatUnits(raw, decimals));
	return `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} ${symbol}`;
};

export const fmtPrice = (n: number) =>
	n.toLocaleString("en-US", { maximumFractionDigits: n >= 1000 ? 0 : 2 });

export const fmtPct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

export const fmtDate = (unix: number) =>
	new Date(unix * 1000).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

export const ago = (unix: number, now = Date.now() / 1000) => {
	const s = Math.max(0, Math.floor(now - unix));
	if (s < 90) return `${s}s ago`;
	if (s < 5400) return `${Math.round(s / 60)} min ago`;
	if (s < 172800) return `${Math.round(s / 3600)} h ago`;
	return `${Math.round(s / 86400)} d ago`;
};

export const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
