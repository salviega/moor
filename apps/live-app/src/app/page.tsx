"use client";

/** Positions (04 §5): every name under the holder's registry, with state, converted share and the agent's pulse. */
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button, Card, Notice, StateBadge } from "@/components/ui";
import { ago, fmtAmount, fmtPct, fmtPrice } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { demoPair } from "@/lib/pair";
import { usePositions, usePrice } from "@/lib/queries";
import { NameField } from "./name-field";

const t = {
	title: "Positions",
	subtitle: (name: string) =>
		`Names under ${name}, read from ENS and Aqua. Nothing here is stored by Moor.`,
	price: (p: string, when: string) => `BTC/USD ${p} · Chainlink, ${when}`,
	empty: "No positions yet. A position is a name under yours that already contains the order.",
	noRegistry: "This name has no Moor registry yet — run first-time setup once.",
	setup: "First-time setup",
	newPosition: "New position",
	loading: "Reading ENS and Aqua…",
	error: "Could not read positions.",
	range: (side: string, min: string, max: string) => `${side} between ${min} and ${max}`,
	converted: "converted",
	committed: "committed",
	unknownAmount: "committed amount not on the name (named before phase 3)",
	agentSilent: "agent has never reported",
	agentStale: (when: string) => `agent last reported ${when} — stale`,
	agentOk: (when: string) => `agent reported ${when}`,
	notMaker: "shipped by another wallet",
};

export default function Positions() {
	const h = useHolder();
	const price = usePrice();
	const q = usePositions(h.name, h.parentLabel);
	const now = Date.now() / 1000;

	return (
		<>
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">{t.title}</h1>
					<p className="text-neutral-400 text-sm">{t.subtitle(h.name)}</p>
					{price.data ? (
						<p className="mt-1 text-neutral-500 text-xs">
							{t.price(fmtPrice(price.data.price), ago(price.data.updatedAt, now))}
						</p>
					) : null}
				</div>
				<Link href="/new">
					<Button>
						<Plus className="h-4 w-4" aria-hidden /> {t.newPosition}
					</Button>
				</Link>
			</header>
			<NameField />
			{q.isLoading ? <p className="text-neutral-400 text-sm">{t.loading}</p> : null}
			{q.isError ? (
				<Notice kind="error">
					{t.error} {q.error instanceof Error ? q.error.message.split("\n")[0] : ""}
				</Notice>
			) : null}
			{q.data && !q.data.registry ? (
				<Notice kind="warn">
					{t.noRegistry}{" "}
					<Link className="underline" href="/setup">
						{t.setup}
					</Link>
				</Notice>
			) : null}
			{q.data?.registry && q.data.positions.length === 0 ? <Notice>{t.empty}</Notice> : null}
			<ul className="flex flex-col gap-3">
				{q.data?.positions.map((p) => {
					const tokenIn = p.side === "buy" ? demoPair.quote : demoPair.base;
					const agent = p.agent.checkedAt
						? now - p.agent.checkedAt > 3600
							? t.agentStale(ago(p.agent.checkedAt, now))
							: t.agentOk(ago(p.agent.checkedAt, now))
						: t.agentSilent;
					return (
						<li key={p.name}>
							<Link href={`/positions/${p.label}`}>
								<Card className="flex flex-col gap-2 hover:border-neutral-600">
									<div className="flex items-center justify-between gap-2">
										<span className="font-medium">{p.name}</span>
										<StateBadge state={p.state} />
									</div>
									<p className="text-neutral-300 text-sm">
										{t.range(
											p.side === "buy" ? "Buy" : "Sell",
											fmtPrice(Number(p.priceMin)),
											fmtPrice(Number(p.priceMax)),
										)}
									</p>
									<p className="text-neutral-400 text-sm">
										{p.amountKnown
											? `${fmtAmount(p.amountIn ?? 0n, tokenIn.decimals, tokenIn.symbol)} ${t.committed} · ${fmtPct(p.converted)} ${t.converted}`
											: t.unknownAmount}
										{p.makerMatches ? "" : ` · ${t.notMaker}`}
									</p>
									<p className="text-neutral-500 text-xs">{agent}</p>
								</Card>
							</Link>
						</li>
					);
				})}
			</ul>
		</>
	);
}
