"use client";

/**
 * The dashboard (04 §5, direction "panel de mando"). Left: who you are, the
 * price and where it has been, your positions as rows. Right: the selected
 * position in panels. One question answered without scrolling: do I have to do
 * anything today? On a phone it is two views: the list, then the position.
 */
import type { PositionView } from "@moor/core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PositionPanel } from "@/components/position-panel";
import { RangeRuler } from "@/components/range-ruler";
import { Button, Notice, Panel, Skeleton, StateMark } from "@/components/ui";
import { ago, fmtAmount, fmtPct, fmtPrice } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { demoPair } from "@/lib/pair";
import { usePositions, usePrice, usePriceHistory } from "@/lib/queries";
import { NameField } from "./name-field";

const t = {
	title: "Positions",
	price: "BTC · USD",
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
	needsYou: "Needs your signature",
	agent: {
		silent: "agent never reported",
		stale: (w: string) => `agent quiet since ${w}`,
		ok: (w: string) => `agent ${w}`,
	},
	pick: {
		title: "Pick a position",
		body: "Its range, balances, the agent's reading and any proposal appear here.",
	},
	back: "All positions",
};

export default function Dashboard() {
	return (
		<Suspense fallback={<Skeleton className="h-40 w-full" />}>
			<DashboardInner />
		</Suspense>
	);
}

function DashboardInner() {
	const h = useHolder();
	const router = useRouter();
	const params = useSearchParams();
	const selected = params.get("position");
	const price = usePrice();
	const history = usePriceHistory();
	const q = usePositions(h.name, h.parentLabel);
	const now = Date.now() / 1000;
	const stale = price.data ? now - price.data.updatedAt > 5400 : false;
	const positions = q.data?.positions ?? [];
	const current = selected ?? positions[0]?.label ?? null;

	const list = (
		<div className="flex flex-col gap-4">
			<NameField quiet />
			<Panel tone="raised" className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between">
					<span className="eyebrow">{t.price}</span>
					{price.data ? (
						<span className="num text-dim text-xs">
							{t.priceWhen(ago(price.data.updatedAt, now), stale)}
						</span>
					) : null}
				</div>
				{price.data ? (
					<span className="num text-2xl text-text">{fmtPrice(price.data.price)}</span>
				) : (
					<Skeleton className="h-7 w-32" />
				)}
				{positions[0] ? (
					<RangeRuler
						compact
						priceMin={Number(positions[0].priceMin)}
						priceMax={Number(positions[0].priceMax)}
						price={price.data?.price}
						side={positions[0].side}
					/>
				) : null}
			</Panel>
			<div className="flex items-center justify-between">
				<h1 className="font-semibold text-xl tracking-tight">{t.title}</h1>
				<Link href="/new">
					<Button className="min-h-9 px-3 py-1 text-xs">{t.open}</Button>
				</Link>
			</div>
			{q.isLoading ? (
				<ul className="flex flex-col gap-2" aria-busy="true" aria-label="Loading positions">
					{[0, 1].map((i) => (
						<li key={i} className="flex flex-col gap-2 rounded-md border border-line p-3">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-24" />
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
			{q.data?.registry && positions.length === 0 ? (
				<section className="flex flex-col gap-3 rounded-md border border-line border-dashed p-5">
					<h2 className="text-base">{t.empty.title}</h2>
					<p className="text-muted text-sm">{t.empty.body}</p>
				</section>
			) : null}
			{positions.length ? (
				<ul
					className="flex flex-col divide-y divide-line rounded-md border border-line"
					aria-label="Your positions"
				>
					{positions.map((p) => (
						<Row
							key={p.name}
							p={p}
							now={now}
							price={price.data?.price}
							active={p.label === current}
							onPick={() => router.push(`/?position=${encodeURIComponent(p.label)}`)}
						/>
					))}
				</ul>
			) : null}
		</div>
	);

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(340px,420px)_1fr]">
			<aside className={selected ? "hidden lg:block" : ""}>{list}</aside>
			<section className={selected ? "" : "hidden lg:block"} aria-live="polite">
				{selected ? (
					<button
						type="button"
						className="mb-3 min-h-11 text-muted text-sm hover:text-text lg:hidden"
						onClick={() => router.push("/")}
					>
						← {t.back}
					</button>
				) : null}
				{current ? (
					<div className="flex flex-col gap-4">
						<PositionPanel key={current} label={current} embedded />
					</div>
				) : q.isLoading ? (
					<div className="flex flex-col gap-4" aria-busy="true">
						<Skeleton className="h-8 w-72" />
						<Skeleton className="h-40 w-full" />
					</div>
				) : (
					<Panel className="flex flex-col gap-1">
						<h2 className="text-base">{t.pick.title}</h2>
						<p className="text-muted text-sm">{t.pick.body}</p>
					</Panel>
				)}
			</section>
		</div>
	);
}

function Row({
	p,
	now,
	active,
	onPick,
	price,
}: {
	p: PositionView;
	now: number;
	active: boolean;
	onPick: () => void;
	price: number | undefined;
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
			<button
				type="button"
				onClick={onPick}
				aria-current={active ? "true" : undefined}
				className={`flex min-h-24 w-full flex-col gap-2 p-4 text-left hover:bg-ink-1 ${active ? "border-l-2 border-l-accent bg-ink-1" : "border-l-2 border-l-transparent"}`}
			>
				<span className="flex items-center justify-between gap-3">
					<span className="truncate text-base text-text">{p.name}</span>
					<StateMark state={p.state} />
				</span>
				<RangeRuler
					compact
					priceMin={Number(p.priceMin)}
					priceMax={Number(p.priceMax)}
					price={price}
					side={p.side}
				/>
				<span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
					<span className="num text-muted text-sm">
						{p.side === "buy" ? "Buy" : "Sell"} {fmtPrice(Number(p.priceMin))}–
						{fmtPrice(Number(p.priceMax))} ·{" "}
						{p.amountKnown
							? `${fmtAmount(p.balanceIn, tokenIn.decimals, tokenIn.symbol)} left`
							: "amount unknown"}
						{p.amountKnown && p.converted > 0 ? ` · ${fmtPct(p.converted)} done` : ""}
					</span>
					{pending ? (
						<span className="rounded-sm border border-accent/60 px-2 py-0.5 text-accent text-xs">
							{t.needsYou}
						</span>
					) : null}
				</span>
				<span className="text-dim text-xs">{agent}</span>
			</button>
		</li>
	);
}
