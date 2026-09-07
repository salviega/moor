"use client";

/**
 * Shown when no Ledger account is connected (04 §2, first thing a judge or a
 * new holder sees). One decision: connect. Everything else earns that click —
 * what Moor does, in three steps, and what each sponsor's tech is doing for
 * it. No scroll: it fills exactly what the dashboard would, via the same
 * flex-height chain (body → main → this).
 */
import { Anchor, ArrowRight, Eye, ShieldCheck } from "lucide-react";
import { Mark } from "./logo";
import { Button } from "./ui";

const t = {
	eyebrow: "A Ledger Live app",
	title: "Moor",
	pitch:
		"Turn the waiting time of holding into productive capital. Sign once from your Ledger; the position does the rest.",
	cta: "Connect Ledger account",
	ctaBrowser: "Open Moor from Ledger Live",
	connecting: "Waiting for Ledger Live…",
	hint: {
		browser:
			"You're viewing this outside Ledger Live. Open Discover → Moor there to connect and sign; you can still read every position from here.",
		app: "Nothing moves until you sign. Reading a position needs no account at all.",
	},
	steps: [
		{
			icon: ShieldCheck,
			title: "Sign once",
			body: "Pick a range and an amount, sign on your Ledger. Your tokens stay in your wallet the whole time.",
		},
		{
			icon: Anchor,
			title: "It's already trading",
			body: "1inch Aqua fills the order only inside your range, only one way — what converts stays converted.",
		},
		{
			icon: Eye,
			title: "Named, watched, yours to decide",
			body: "An ENS name anyone can read. An agent watches and proposes; only your signature can act.",
		},
	],
	sponsors: [
		{
			name: "1inch",
			logo: "/sponsor-1inch.png",
			role: "Aqua & SwapVM",
			body: "hold the order and the balance — no Moor contract ever touches your funds.",
		},
		{
			name: "ENS",
			logo: "/sponsor-ens.png",
			role: "ENSv2",
			body: "gives every position a name anyone can read, with on-chain, per-key permissions.",
		},
		{
			name: "Ledger",
			logo: "/sponsor-ledger.png",
			role: "Wallet API & Key Ring",
			body: "sign on the device; the agent's one narrow key never touches a disk.",
		},
	],
};

export function Landing({
	onConnect,
	connecting,
	host,
}: {
	onConnect: () => void;
	connecting: boolean;
	host: "ledger-live" | "simulator" | "browser" | undefined;
}) {
	const inBrowser = host === "browser";
	return (
		<div className="grid h-full grid-rows-[1fr_auto_auto] items-center gap-4 py-2 sm:gap-8 sm:py-4">
			<div className="animate-in-1 flex flex-col items-center gap-3 text-center sm:gap-5">
				<Mark className="h-12 w-12 text-text sm:h-16 sm:w-16" title="" />
				<span className="eyebrow">{t.eyebrow}</span>
				<h1 className="font-semibold text-4xl text-text tracking-tight sm:text-6xl">{t.title}</h1>
				<p className="max-w-md text-base text-muted sm:max-w-lg sm:text-lg">{t.pitch}</p>
				<Button
					onClick={onConnect}
					busy={connecting}
					className="cta-pulse min-h-11 px-6 text-sm sm:min-h-14 sm:px-8 sm:text-base"
				>
					{connecting ? t.connecting : inBrowser ? t.ctaBrowser : t.cta}
					<ArrowRight className="h-4 w-4" aria-hidden />
				</Button>
				<p className="max-w-md text-dim text-xs">{inBrowser ? t.hint.browser : t.hint.app}</p>
			</div>

			<div className="animate-in-2 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
				{t.steps.map((s, i) => (
					<div
						key={s.title}
						className="flex flex-col gap-1.5 rounded-md border border-line p-3 sm:gap-2 sm:p-4"
					>
						<div className="flex items-center gap-2">
							<span className="eyebrow">Step {i + 1}</span>
						</div>
						<s.icon className="h-5 w-5 text-accent" aria-hidden />
						<h2 className="text-base text-text">{s.title}</h2>
						<p className="text-muted text-sm">{s.body}</p>
					</div>
				))}
			</div>

			<div className="animate-in-3 grid grid-cols-1 gap-3 border-line border-t pt-4 sm:grid-cols-3 sm:gap-4 sm:pt-6">
				{t.sponsors.map((s) => (
					<div key={s.name} className="flex items-start gap-3">
						<img
							src={s.logo}
							alt=""
							width={40}
							height={40}
							className="h-10 w-10 shrink-0 rounded-md border border-line object-cover"
						/>
						<div className="flex flex-col gap-1">
							<span className="font-semibold text-lg text-text">{s.name}</span>
							<span className="eyebrow text-dim">{s.role}</span>
							<p className="text-muted text-sm">{s.body}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
