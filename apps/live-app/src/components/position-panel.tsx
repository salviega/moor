"use client";

/**
 * One position. The decision here: accept the agent's proposal, close, or
 * leave it working. The proposal is pending and looks pending; what already
 * happened looks settled. Closing is its own row, away from the primary.
 */
import { acceptProposalCalls, closeCalls, readAddr, revokeAgentCall } from "@moor/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StepRow } from "@/app/new/page";
import { PendingBand } from "@/components/pending-band";
import { RangeRuler } from "@/components/range-ruler";
import { useToast } from "@/components/toast";
import { Button, Details, Notice, Panel, Skeleton, Stat, StateMark } from "@/components/ui";
import { publicClient } from "@/lib/chain";
import {
	ago,
	daysLeft,
	fmtAmount,
	fmtDate,
	fmtPct,
	fmtPrice,
	fmtShort,
	fmtUsd,
	short,
} from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { demoPair, explorer } from "@/lib/pair";
import {
	usePosition,
	usePrice,
	usePriceHistory,
	useSetupStatus,
	useTokenAccount,
} from "@/lib/queries";
import { useSignSession } from "@/lib/session";

const t = {
	back: "Positions",
	error: {
		title: "Could not read this position",
		body: "Sepolia did not answer. The position is not affected; the read is.",
		retry: "Try again",
	},
	stateLine: {
		waiting: (pct: string, dir: string) =>
			`The price is ${pct} ${dir} the range. Nothing trades until it enters.`,
		working: "The price is in the range; the order fills a little on each trade.",
		completed: "Everything you committed is converted. The order has nothing left to do.",
		expired: "The order stopped on its deadline. Your tokens are where they always were.",
		closed: "The order was stopped and the name removed.",
	},
	stats: {
		committed: "Committed",
		left: "Left to convert",
		converted: "Converted",
		received: "Received",
		expires: "Expires",
		fee: "Your fee",
	},
	notMaker: {
		title: "Shipped by another wallet",
		body: "The order this name points at was opened by a different account, so the balances shown belong to this name's owner and are zero. This is the phase-1 demo position.",
	},
	unknownAmount:
		"This name was written before the committed amount was recorded, so the converted share cannot be derived.",
	agent: {
		title: "Agent",
		identity: (n: string) => `${n}`,
		canOnly:
			"It can write these lines and nothing else — no funds, no strategy, no name. Verifiable on chain.",
		silent: "Has never reported on this position. The position does not need it.",
		stale: (w: string) =>
			`Quiet since ${w}. The position keeps working; the agent is the one that is silent.`,
		last: (w: string) => `Last reading ${w}`,
		revoke: "Revoke the agent",
		revokeHint: "One signature. It loses its only permission; the position keeps working.",
	},
	close: {
		title: "Stop and close",
		body: "Two signatures: stop the order on Aqua, then remove the name. Your tokens were never anywhere else. This cannot be undone; you can open a new position later.",
		action: "Stop and close the position",
	},
	needAccount: "Choose the account that owns this name to act.",
	browser: "Open Moor from Ledger Live to sign.",
	done: {
		close: "Position closed and name removed.",
		revoke: "Agent revoked.",
		accept: (next: string | null) =>
			next ? `Done. The successor is ${next}.` : "Done. Position closed.",
	},
	failed: "The session stopped. Nothing after the failed step was sent.",
	session: { accept: "Signing the proposal", close: "Closing", revoke: "Revoking the agent" },
	confirm: "Confirm on your Ledger…",
};

type Act = "close" | "revoke" | "accept";

export function PositionPanel({ label, embedded = false }: { label: string; embedded?: boolean }) {
	const h = useHolder();
	const q = usePosition(h.name, label);
	const price = usePrice();
	const history = usePriceHistory();
	const setup = useSetupStatus(h.parentLabel);
	const session = useSignSession();
	const toast = useToast();
	const qc = useQueryClient();
	const [acting, setActing] = useState<Act | null>(null);
	const [dismissed, setDismissed] = useState<string | null>(null);
	const p = q.data;
	const tokenIn = p ? (p.side === "buy" ? demoPair.quote : demoPair.base) : demoPair.quote;
	const tokenOut = p ? (p.side === "buy" ? demoPair.base : demoPair.quote) : demoPair.base;
	const acct = useTokenAccount(h.address, tokenIn.address);
	const agentAddr = useQuery({
		queryKey: ["addr", p?.agentName],
		queryFn: () => readAddr(publicClient, p?.agentName ?? ""),
		enabled: !!p?.agentName,
	});
	const now = Date.now() / 1000;
	const cur = price.data?.price;
	const dismissKey = p ? `moor.dismiss.${p.name}` : "";
	useEffect(() => {
		try {
			setDismissed(dismissKey ? window.localStorage.getItem(dismissKey) : null);
		} catch {}
	}, [dismissKey]);

	const proposal = p?.agent.proposal && p.agent.proposal.kind !== "none" ? p.agent.proposal : null;
	const proposalId = proposal ? JSON.stringify(proposal) : "";
	const acceptCalls =
		p && proposal && setup.data?.resolver
			? acceptProposalCalls({
					view: p,
					proposal,
					pair: demoPair,
					names: { registry: p.registry, resolver: setup.data.resolver },
					allowance: acct.data?.allowance ?? 0n,
					now: Math.floor(now),
				})
			: null;
	const reason =
		h.host === "browser"
			? t.browser
			: !h.accountId || h.nameMatches !== true
				? t.needAccount
				: undefined;
	const canAct = !reason;

	const act = async (kind: Act) => {
		if (!p || !h.accountId) return;
		setActing(kind);
		const calls =
			kind === "accept"
				? (acceptCalls ?? [])
				: kind === "close"
					? closeCalls({
							strategyHash: p.strategyHash,
							tokens: [p.tokenIn, p.tokenOut],
							registry: p.registry,
							label: p.label,
						})
					: [
							revokeAgentCall({
								resolver: setup.data?.resolver ?? p.registry,
								agent: agentAddr.data ?? p.holder,
							}),
						];
		const ok = await session.run(h.accountId, calls);
		const successor =
			kind === "accept" && calls.some((c) => c.kind === "createPosition")
				? nextName(p.label)
				: null;
		if (ok)
			toast(
				"ok",
				kind === "close"
					? t.done.close
					: kind === "revoke"
						? t.done.revoke
						: t.done.accept(successor),
			);
		await qc.invalidateQueries({ queryKey: ["position", h.name, label] });
		await qc.invalidateQueries({ queryKey: ["positions"] });
	};

	if (q.isLoading)
		return (
			<div className="flex flex-col gap-4" aria-busy="true">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-8 w-72" />
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-40 w-full" />
			</div>
		);
	if (q.isError || !p)
		return (
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
		);

	const lo = Number(p.priceMin);
	const hi = Number(p.priceMax);
	const stateLine =
		p.state === "waiting" && cur !== undefined
			? t.stateLine.waiting(
					`${(cur > hi ? (cur / hi - 1) * 100 : (1 - cur / lo) * 100).toFixed(0)}%`,
					cur > hi ? "above" : "below",
				)
			: p.state === "waiting"
				? ""
				: t.stateLine[p.state];
	const agentStale = p.agent.checkedAt ? now - p.agent.checkedAt > 3600 : false;
	const failed = session.steps.some((s) => s.status === "failed");

	return (
		<div className={`flex flex-col ${embedded ? "h-full gap-3" : "gap-4"}`}>
			{!embedded ? (
				<Link
					href="/"
					className="min-h-11 self-start text-muted text-sm leading-11 hover:text-text"
				>
					← {t.back}
				</Link>
			) : null}
			<header className="flex flex-col gap-2">
				<h1 className={`font-semibold tracking-tight ${embedded ? "text-xl" : "text-2xl"}`}>
					{p.name}
				</h1>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<StateMark state={p.state} />
					<span className="text-muted text-sm">{stateLine}</span>
				</div>
			</header>

			{proposal && dismissed !== proposalId && p.state !== "closed" ? (
				<PendingBand
					proposal={proposal}
					simulation={p.agent.simulation}
					when={p.agent.checkedAt ? ago(p.agent.checkedAt, now) : "recently"}
					signatures={acceptCalls?.length ?? 0}
					onReview={() => act("accept")}
					onDismiss={() => {
						try {
							window.localStorage.setItem(dismissKey, proposalId);
						} catch {}
						setDismissed(proposalId);
					}}
					disabledReason={reason ?? (!acceptCalls ? "Reading the name's resolver…" : undefined)}
					busy={acting === "accept" && session.running}
				/>
			) : null}

			<div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[3fr_2fr]">
				<Panel tone="raised" className="flex flex-col justify-center gap-3">
					<span className="eyebrow">Price against the range · last 48 h</span>
					<RangeRuler
						priceMin={lo}
						priceMax={hi}
						price={cur}
						history={history.data ?? []}
						side={p.side}
					/>
				</Panel>
				<Panel tone="raised" className="flex flex-col justify-center gap-4">
					<div className="grid grid-cols-2 gap-x-6 gap-y-5">
						<Stat
							label={t.stats.committed}
							value={
								p.amountKnown ? fmtAmount(p.amountIn ?? 0n, tokenIn.decimals, tokenIn.symbol) : "—"
							}
							sub={
								p.amountKnown && cur
									? `≈ ${fmtUsd(p.amountIn ?? 0n, tokenIn.decimals, p.side === "buy" ? 1 : cur)}`
									: undefined
							}
						/>
						<Stat
							label={t.stats.left}
							value={fmtAmount(p.balanceIn, tokenIn.decimals, tokenIn.symbol)}
							sub={p.amountKnown ? `${fmtPct(p.converted)} converted` : undefined}
						/>
						<Stat
							label={t.stats.received}
							value={fmtAmount(p.balanceOut, tokenOut.decimals, tokenOut.symbol)}
							sub={
								cur && p.balanceOut > 0n
									? `≈ ${fmtUsd(p.balanceOut, tokenOut.decimals, p.side === "buy" ? cur : 1)}`
									: undefined
							}
						/>
						<Stat
							label={t.stats.expires}
							value={p.expiry ? fmtDate(p.expiry) : "—"}
							sub={p.expiry ? `${daysLeft(p.expiry, now)} days left` : undefined}
						/>
						<Stat
							label="Range"
							value={`${fmtPrice(lo)} – ${fmtPrice(hi)}`}
							sub={`${p.side === "buy" ? "buys" : "sells"} BTC · USD per BTC`}
						/>
						<Stat
							label="Owner"
							value={short(p.holder)}
							sub={
								h.address && p.holder.toLowerCase() === h.address.toLowerCase()
									? "this account"
									: undefined
							}
						/>
					</div>
				</Panel>
			</div>
			{!p.makerMatches ? (
				<p className="text-accent text-xs">
					<span className="font-medium">{t.notMaker.title}.</span> {t.notMaker.body}
				</p>
			) : null}
			{!p.amountKnown ? <p className="text-dim text-xs">{t.unknownAmount}</p> : null}

			<div className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-[3fr_2fr_2fr]">
				<Panel className="flex flex-col gap-3">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h2 className="text-base">{t.agent.title}</h2>
						<span className="num text-dim text-xs">
							{p.agentName}
							{agentAddr.data ? ` → ${short(agentAddr.data)}` : ""}
						</span>
					</div>
					<p className="text-dim text-xs">{t.agent.canOnly}</p>
					{p.agent.checkedAt ? (
						<>
							<p className={agentStale ? "text-accent" : "text-muted"}>
								{agentStale
									? t.agent.stale(ago(p.agent.checkedAt, now))
									: t.agent.last(ago(p.agent.checkedAt, now))}
							</p>
							<dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
								{p.agent.price !== undefined ? (
									<Stat label="price it saw" value={fmtPrice(p.agent.price)} />
								) : null}
								{p.agent.state ? <Stat label="state it derived" value={p.agent.state} /> : null}
								{p.agent.filled ? <Stat label="filled" value={p.agent.filled} /> : null}
								{p.agent.fees && p.agent.fees !== "n/a" ? (
									<Stat label="fees" value={p.agent.fees} />
								) : null}
							</dl>
							{p.agent.proposalError ? <Notice tone="warn">{p.agent.proposalError}</Notice> : null}
							{proposal && dismissed === proposalId ? (
								<button
									type="button"
									className="min-h-11 self-start text-accent text-sm underline"
									onClick={() => setDismissed(null)}
								>
									Show the pending proposal again
								</button>
							) : null}
						</>
					) : (
						<p className="text-muted">{t.agent.silent}</p>
					)}
					<div className="flex flex-wrap items-center gap-3 border-line border-t pt-3">
						<Button
							variant="quiet"
							onClick={() => act("revoke")}
							disabled={!canAct || session.running}
							reason={reason}
							busy={acting === "revoke" && session.running}
						>
							{acting === "revoke" && session.running ? t.confirm : t.agent.revoke}
						</Button>
						<span className="text-dim text-xs">{t.agent.revokeHint}</span>
					</div>
				</Panel>

				{session.steps.length ? (
					<Panel className="flex flex-col gap-3">
						<span className="eyebrow">{acting ? t.session[acting] : ""}</span>
						<ol className="flex flex-col gap-3">
							{session.steps.map((s, i) => (
								<StepRow key={s.call.kind} i={i} step={s} />
							))}
						</ol>
						{failed ? <Notice tone="error">{t.failed}</Notice> : null}
					</Panel>
				) : null}

				{p.state !== "closed" ? (
					<Panel className="flex flex-col gap-3">
						<h2 className="text-base">{t.close.title}</h2>
						<p className="max-w-prose text-muted">{t.close.body}</p>
						<div>
							<Button
								variant="danger"
								onClick={() => act("close")}
								disabled={!canAct || session.running}
								reason={reason}
								busy={acting === "close" && session.running}
							>
								{acting === "close" && session.running ? t.confirm : t.close.action}
							</Button>
						</div>
					</Panel>
				) : null}

				<Details>
					<span>name {p.name}</span>
					<span>strategyHash {p.strategyHash}</span>
					<span>owner {p.holder}</span>
					<span>registry {p.registry}</span>
					<span>tokenIn {p.tokenIn}</span>
					<span>tokenOut {p.tokenOut}</span>
					<a
						className="underline"
						href={explorer("address", p.holder)}
						target="_blank"
						rel="noreferrer"
					>
						owner on etherscan
					</a>
				</Details>
			</div>
		</div>
	);
}

function nextName(label: string): string {
	const m = label.match(/^(.*)-(\d+)$/);
	return m ? `${m[1]}-${Number(m[2]) + 1}` : `${label}-2`;
}
