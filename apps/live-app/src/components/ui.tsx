"use client";

import type { PositionState } from "@moor/core";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
	variant = "primary",
	busy,
	className = "",
	children,
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "ghost" | "danger";
	busy?: boolean;
}) {
	const base =
		"inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
	const look = {
		primary: "bg-emerald-400 text-neutral-950 hover:bg-emerald-300",
		ghost: "border border-neutral-700 text-neutral-100 hover:bg-neutral-800",
		danger: "border border-red-800 text-red-200 hover:bg-red-950",
	}[variant];
	return (
		<button
			type="button"
			className={`${base} ${look} ${className}`}
			disabled={busy || rest.disabled}
			{...rest}
		>
			{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
			{children}
		</button>
	);
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<section className={`rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 ${className}`}>
			{children}
		</section>
	);
}

export function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string | undefined;
	children: ReactNode;
}) {
	return (
		<label className="flex flex-col gap-1 text-sm">
			<span className="text-neutral-300">{label}</span>
			{children}
			{hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
		</label>
	);
}

export const inputClass =
	"rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-emerald-400";

const stateLook: Record<PositionState, string> = {
	waiting: "border-neutral-600 text-neutral-300",
	working: "border-emerald-600 text-emerald-300",
	completed: "border-sky-600 text-sky-300",
	expired: "border-amber-700 text-amber-300",
	closed: "border-neutral-700 text-neutral-500",
};

export function StateBadge({ state }: { state: PositionState }) {
	return (
		<span
			className={`rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide ${stateLook[state]}`}
		>
			{state}
		</span>
	);
}

export function Notice({
	kind = "info",
	children,
}: {
	kind?: "info" | "warn" | "error";
	children: ReactNode;
}) {
	const look = {
		info: "border-neutral-700 text-neutral-300",
		warn: "border-amber-800 bg-amber-950/40 text-amber-200",
		error: "border-red-800 bg-red-950/40 text-red-200",
	}[kind];
	return <div className={`rounded-md border px-3 py-2 text-sm ${look}`}>{children}</div>;
}
