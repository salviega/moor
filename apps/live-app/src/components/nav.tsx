"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
	switchAccount: "Switch account",
	disconnect: "Disconnect from this app",
	disconnectHint: "The account stays in Ledger Live; Moor just stops using it here.",
	network: "Sepolia",
	host: { "ledger-live": "Ledger Live", simulator: "simulator", browser: "browser · read only" },
};

export function Nav() {
	const path = usePathname();
	const h = useHolder();
	const [open, setOpen] = useState(false);
	const menu = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent | KeyboardEvent) => {
			if (
				e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node)
			)
				setOpen(false);
		};
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", close);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", close);
		};
	}, [open]);
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
			<div className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-1.5 lg:px-8">
				<nav className="flex items-center gap-1" aria-label="Main">
					<Link
						href="/"
						className="mr-3 min-h-11 font-semibold text-base leading-11 tracking-tight"
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
						<div className="relative" ref={menu}>
							<button
								type="button"
								onClick={() => setOpen((o) => !o)}
								aria-haspopup="menu"
								aria-expanded={open}
								className="num flex min-h-9 items-center gap-1.5 rounded-md border border-line px-2 text-muted hover:text-text"
								title={h.address}
							>
								{short(h.address)}
								<ChevronDown className="h-3.5 w-3.5" aria-hidden />
							</button>
							{open ? (
								<div
									role="menu"
									className="absolute right-0 z-20 mt-1 flex w-64 flex-col rounded-md border border-line bg-ink-1 p-1 shadow-none"
								>
									<button
										type="button"
										role="menuitem"
										className="min-h-11 rounded px-3 text-left text-sm text-text hover:bg-ink-2"
										onClick={() => {
											setOpen(false);
											h.connect();
										}}
									>
										{t.switchAccount}
									</button>
									<button
										type="button"
										role="menuitem"
										className="min-h-11 rounded px-3 text-left text-sm text-text hover:bg-ink-2"
										onClick={() => {
											setOpen(false);
											h.disconnect();
										}}
									>
										{t.disconnect}
									</button>
									<span className="px-3 pb-2 text-dim text-xs">{t.disconnectHint}</span>
								</div>
							) : null}
						</div>
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
