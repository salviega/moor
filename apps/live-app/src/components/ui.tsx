"use client";

import type { PositionState } from "@moor/core";
import { ChevronRight, Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { short } from "@/lib/format";
import { explorer } from "@/lib/pair";

/**
 * Six components, one accent. Primary is amber and means "this signs on your
 * Ledger". Quiet is for everything else. Danger is never next to primary.
 */
export function Button({
	variant = "primary",
	busy,
	reason,
	className = "",
	children,
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "quiet" | "danger" | undefined;
	busy?: boolean | undefined;
	/** Why it is disabled — shown next to it, never left to guesswork. */
	reason?: string | undefined;
}) {
	const base =
		"inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
	const look = {
		primary: "bg-accent text-accent-ink hover:brightness-110",
		quiet: "border border-line-strong text-text hover:bg-ink-2",
		danger: "border border-line-strong text-bad hover:bg-ink-2",
	}[variant];
	const disabled = busy || rest.disabled;
	return (
		<span className="inline-flex flex-col items-end gap-1">
			<button
				type="button"
				className={`${base} ${look} ${className}`}
				disabled={disabled}
				aria-disabled={disabled}
				{...rest}
			>
				{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
				{children}
			</button>
			{disabled && reason ? <span className="text-dim text-xs">{reason}</span> : null}
		</span>
	);
}

export function Panel({
	children,
	className = "",
	tone = "flat",
}: {
	children: ReactNode;
	className?: string;
	tone?: "flat" | "raised";
}) {
	return (
		<section
			className={`rounded-md border border-line ${tone === "raised" ? "bg-ink-1" : ""} p-4 ${className}`}
		>
			{children}
		</section>
	);
}

export function Field({
	label,
	unit,
	hint,
	error,
	children,
}: {
	label: string;
	unit?: string | undefined;
	hint?: string | undefined;
	error?: string | undefined;
	children: ReactNode;
}) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="flex items-baseline justify-between">
				<span className="text-muted text-sm">{label}</span>
				{unit ? <span className="eyebrow">{unit}</span> : null}
			</span>
			{children}
			{error ? (
				<span className="text-bad text-xs">{error}</span>
			) : hint ? (
				<span className="text-dim text-xs">{hint}</span>
			) : null}
		</label>
	);
}

export const inputClass =
	"num min-h-11 w-full rounded-md border border-line-strong bg-ink-0 px-3 py-2 text-base text-text outline-none placeholder:text-dim focus:border-accent";

const stateMeta: Record<PositionState, { dot: string; text: string; word: string }> = {
	waiting: { dot: "bg-dim", text: "text-muted", word: "Waiting" },
	working: { dot: "bg-good", text: "text-good", word: "Working" },
	completed: { dot: "bg-good", text: "text-good", word: "Completed" },
	expired: { dot: "bg-accent", text: "text-accent", word: "Expired" },
	closed: { dot: "bg-line-strong", text: "text-dim", word: "Closed" },
};

/** State is the product: a dot and a word, never only a colour. */
export function StateMark({ state }: { state: PositionState }) {
	const m = stateMeta[state];
	return (
		<span className={`inline-flex items-center gap-1.5 text-sm ${m.text}`}>
			<span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} aria-hidden />
			{m.word}
		</span>
	);
}

export function Notice({
	tone = "info",
	title,
	children,
	action,
}: {
	tone?: "info" | "warn" | "error";
	title?: string;
	children: ReactNode;
	action?: ReactNode;
}) {
	const look = {
		info: "border-line text-muted",
		warn: "border-accent/60 text-text",
		error: "border-bad/60 text-text",
	}[tone];
	return (
		<div
			className={`flex flex-col gap-2 rounded-md border px-3 py-2.5 text-sm ${look}`}
			role={tone === "error" ? "alert" : undefined}
		>
			{title ? (
				<span
					className={`font-medium ${tone === "error" ? "text-bad" : tone === "warn" ? "text-accent" : "text-text"}`}
				>
					{title}
				</span>
			) : null}
			<div>{children}</div>
			{action ? <div>{action}</div> : null}
		</div>
	);
}

/** Debugging data lives here, one click away, never by default. */
export function Details({
	summary = "Technical details",
	children,
}: {
	summary?: string;
	children: ReactNode;
}) {
	return (
		<details className="group rounded-md border border-line">
			<summary className="flex min-h-11 items-center justify-between px-3 text-muted text-sm hover:text-text">
				{summary}
				<ChevronRight className="h-4 w-4 transition group-open:rotate-90" aria-hidden />
			</summary>
			<div className="num flex flex-col gap-1.5 break-all border-line border-t px-3 py-3 text-dim text-xs">
				{children}
			</div>
		</details>
	);
}

export function Skeleton({ className = "" }: { className?: string }) {
	return <span className={`skeleton block ${className}`} aria-hidden />;
}

/** An address or a transaction hash, always a link to the block explorer — a judge can follow every one. */
export function ExplorerLink({
	kind,
	id,
	short: shorten = false,
	className = "",
}: {
	kind: "address" | "tx";
	id: string;
	short?: boolean;
	className?: string;
}) {
	return (
		<a
			className={`num underline decoration-dotted underline-offset-2 hover:text-text ${className}`}
			href={explorer(kind, id)}
			target="_blank"
			rel="noreferrer"
			title={shorten ? id : undefined}
		>
			{shorten ? short(id) : id}
		</a>
	);
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<span className="eyebrow">{label}</span>
			<span className="num truncate text-base text-text">{value}</span>
			{sub ? <span className="num text-dim text-xs">{sub}</span> : null}
		</div>
	);
}
