"use client";

/**
 * Positions — the logbook. A holder comes back to answer one question: do I
 * have to do anything today? Every row says its state, where the price sits
 * against the range, what is left, and whether the agent is alive. Nothing
 * here is stored by Moor: it is ENS, Aqua and Chainlink, read now.
 */
import type { PositionView } from "@moor/core";
import Link from "next/link";
import { RangeRuler } from "@/components/range-ruler";
import { Button, Notice, Skeleton, StateMark } from "@/components/ui";
import { ago, fmtAmount, fmtPct, fmtPrice } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { demoPair } from "@/lib/pair";
import { usePositions, usePrice, usePriceHistory } from "@/lib/queries";
import { NameField } from "./name-field";

const t = {
	title: "Positions",
	price: (p: string) => `BTC · ${p} USD`,
	priceWhen: (when: string, stale: boolean) =>
		stale ? `Chainlink, ${when} — older than usual` : `Chainlink, ${when}`,
	open: "Open a position",
	empty: {
		title: "No positions under this name yet",
		body: "A position is a name under yours that already holds the order: it buys or sells BTC only when the price enters the range you chose, earns a fee on each trade, and your tokens never leave your wallet.",
	},
	noRegistry: {
		title: "This name is not set up for Moor yet",
		body: "Once per name, Moor's registrar is allowed to create position names under it — and nothing else.",
		action: "See what setup does",
	},
	error: {
		title: "Could not read your positions",
		body: "Sepolia did not answer. Nothing is wrong with your positions; the read failed.",
		retry: "Try again",
	},
	cols: { position: "Position", range: "Range · price", left: "Left to convert", agent: "Agent" },
	needsYou: "Needs your signature",
	agent: {
		silent: "never reported",
		stale: (w: string) => `quiet since ${w}`,
		ok: (w: string) => `reported ${w}`,
	},
	pending: "pending",
};

export default function Positions() {
	const h = useHolder();
	const price = usePrice();
	const history = usePriceHistory();
	const q = usePositions(h.name, h.parentLabel);
	const now = Date.now() / 1000;
	const stale = price.data ? now - price.data.updatedAt > 5400 : false;

	return (
		<>
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="font-semibold text-2xl tracking-tight">{t.title}</h1>
					{price.data ? (
						<p className="num text-muted text-sm">
							{t.price(fmtPrice(price.data.price))}{" "}
							<span className="text-dim">
								· {t.priceWhen(ago(price.data.updatedAt, now), stale)}
							</span>
						</p>
					) : (
						<Skeleton className="h-4 w-56" />
					)}
				</div>
				<Link href="/new">
					<Button>{t.open}</Button>
				</Link>
			</header>
			<NameField quiet />

			{q.isLoading ? (
				<ul className="flex flex-col gap-2" aria-busy="true" aria-label="Loading positions">
					{[0, 1].map((i) => (
						<li key={i} className="flex flex-col gap-3 rounded-md border border-line p-4">
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-7 w-full" />
							<Skeleton className="h-4 w-64" />
						</li>
					))}
				</ul>
			) : null}
			{q.isError ? (
				<Notice
					tone="error"
					title={t.error.title}
					action={
						<Button variant="quiet" onClick={() => q.refetch()}>
							{t.error.retry}
						</Button>
					}
				>
					{t.error.body}
				</Notice>
			) : null}
			{q.data && !q.data.registry ? (
				<Notice
					tone="warn"
					title={t.noRegistry.title}
					action={
						<Link href="/setup" className="underline">
							{t.noRegistry.action}
						</Link>
					}
				>
					{t.noRegistry.body}
				</Notice>
			) : null}
			{q.data?.registry && q.data.positions.length === 0 ? (
				<section className="flex flex-col gap-3 rounded-md border border-line border-dashed p-6">
					<h2 className="text-lg">{t.empty.title}</h2>
					<p className="max-w-prose text-muted">{t.empty.body}</p>
					<Link href="/new" className="self-start">
						<Button>{t.open}</Button>
					</Link>
				</section>
			) : null}

			{q.data?.positions.length ? (
				<ul
					className="flex flex-col divide-y divide-line rounded-md border border-line"
					aria-label="Your positions"
				>
					{q.data.positions.map((p) => (
						<Row
							key={p.name}
							p={p}
							price={price.data?.price}
							history={history.data ?? []}
							now={now}
						/>
					))}
				</ul>
			) : null}
		</>
	);
}

function Row({
	p,
	price,
	history,
	now,
}: {
	p: PositionView;
	price: number | undefined;
	history: { price: number; updatedAt: number }[];
	now: number;
}) {
	const tokenIn = p.side === "buy" ? demoPair.quote : demoPair.base;
	const pending = p.agent.proposal && p.agent.proposal.kind !== "none";
	const agent = p.agent.checkedAt
		? now - p.agent.checkedAt > 3600
			? t.agent.stale(ago(p.agent.checkedAt, now))
			: t.agent.ok(ago(p.agent.checkedAt, now))
		: t.agent.silent;
	return (
		<li>
			<Link
				href={`/positions/${p.label}`}
				className="grid grid-cols-1 gap-3 p-4 hover:bg-ink-1 sm:grid-cols-[1.2fr_1.4fr_1fr] sm:items-center sm:gap-6"
			>
				<div className="flex min-w-0 flex-col gap-1">
					<span className="truncate text-base text-text">{p.name}</span>
					<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<StateMark state={p.state} />
						{pending ? (
							<span className="rounded-sm border border-accent/60 px-1.5 py-0.5 text-accent text-xs">
								{t.needsYou}
							</span>
						) : null}
					</span>
				</div>
				<div className="flex flex-col gap-1">
					<RangeRuler
						compact
						priceMin={Number(p.priceMin)}
						priceMax={Number(p.priceMax)}
						price={price}
						history={history}
						side={p.side}
					/>
					<span className="num text-dim text-xs">
						{p.side === "buy" ? "Buy" : "Sell"} {fmtPrice(Number(p.priceMin))} –{" "}
						{fmtPrice(Number(p.priceMax))}
					</span>
				</div>
				<div className="flex flex-col gap-0.5 sm:text-right">
					<span className="num text-text">
						{p.amountKnown
							? fmtAmount(p.balanceIn, tokenIn.decimals, tokenIn.symbol)
							: "amount unknown"}
					</span>
					{p.amountKnown ? (
						<span className="num text-dim text-xs">{fmtPct(p.converted)} converted</span>
					) : null}
					<span className="text-dim text-xs">agent {agent}</span>
				</div>
			</Link>
		</li>
	);
}
