"use client";

import { Anchor, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { short } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { useSimulator } from "@/lib/wallet-api";
import { Button } from "./ui";

const t = {
	brand: "Moor",
	positions: "Positions",
	newPosition: "New position",
	setup: "Setup",
	connect: "Connect Ledger Live account",
	connecting: "Waiting for Ledger Live…",
	host: (sim: boolean) => (sim ? "simulator" : "Ledger Live"),
};

export function Nav() {
	const path = usePathname();
	const h = useHolder();
	const item = (href: string, label: string, Icon: typeof Anchor) => (
		<Link
			href={href}
			className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm ${path === href ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:text-neutral-100"}`}
		>
			<Icon className="h-4 w-4" aria-hidden /> {label}
		</Link>
	);
	return (
		<header className="flex flex-wrap items-center justify-between gap-3 border-neutral-800 border-b px-4 py-3">
			<nav className="flex items-center gap-2">
				<Link href="/" className="mr-2 font-semibold text-lg tracking-tight">
					{t.brand}
				</Link>
				{item("/", t.positions, Anchor)}
				{item("/new", t.newPosition, Plus)}
				{item("/setup", t.setup, Settings)}
			</nav>
			<div className="flex items-center gap-3 text-xs text-neutral-400">
				<span>Sepolia · {t.host(useSimulator)}</span>
				{h.connectError ? <span className="text-red-300">{String(h.connectError)}</span> : null}
				{h.address ? (
					<span className="font-mono text-neutral-200">{short(h.address)}</span>
				) : (
					<Button variant="ghost" onClick={h.connect} busy={h.connecting}>
						{h.connecting ? t.connecting : t.connect}
					</Button>
				)}
			</div>
		</header>
	);
}
