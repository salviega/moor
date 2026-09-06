"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { short } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { Button } from "./ui";

const t = {
	brand: "Moor",
	positions: "Positions",
	newPosition: "Open a position",
	setup: "Setup",
	connect: "Choose Ledger account",
	connecting: "Waiting for Ledger Live…",
	network: "Sepolia",
	host: { "ledger-live": "Ledger Live", simulator: "simulator", browser: "browser · read only" },
};

export function Nav() {
	const path = usePathname();
	const h = useHolder();
	const item = (href: string, label: string) => (
		<Link
			href={href}
			aria-current={path === href ? "page" : undefined}
			className={`flex min-h-11 items-center rounded-md px-3 text-sm ${path === href ? "text-text" : "text-muted hover:text-text"}`}
		>
			{label}
		</Link>
	);
	return (
		<header className="border-line border-b">
			<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-2">
				<nav className="flex items-center gap-1" aria-label="Main">
					<Link
						href="/"
						className="mr-3 min-h-11 font-semibold text-base tracking-tight leading-11"
					>
						{t.brand}
					</Link>
					{item("/", t.positions)}
					{item("/new", t.newPosition)}
					{item("/setup", t.setup)}
				</nav>
				<div className="flex items-center gap-3 text-xs">
					<span className="eyebrow">
						{t.network} · {h.host ? t.host[h.host] : "…"}
					</span>
					{h.address ? (
						<span
							className="num rounded-md border border-line px-2 py-1 text-muted"
							title={h.address}
						>
							{short(h.address)}
						</span>
					) : (
						<Button
							variant="quiet"
							onClick={h.connect}
							busy={h.connecting}
							className="min-h-9 px-3 py-1 text-xs"
						>
							{h.connecting ? t.connecting : t.connect}
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}
