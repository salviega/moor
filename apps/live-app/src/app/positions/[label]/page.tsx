"use client";

/**
 * Position detail (04 §5): state, range vs price, converted share, expiry, the
 * name — and the agent's panel: last reading and proposal, if any. Two actions,
 * both signed on the Ledger: Close (dock + unregister) and Revoke agent.
 */
import { acceptProposalCalls, closeCalls, readAddr, revokeAgentCall } from "@moor/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Card, Notice, StateBadge } from "@/components/ui";
import { publicClient } from "@/lib/chain";
import { ago, fmtAmount, fmtDate, fmtPct, fmtPrice, short } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { demoPair, explorer } from "@/lib/pair";
import { usePosition, usePrice, useSetupStatus, useTokenAccount } from "@/lib/queries";
import { useSignSession } from "@/lib/session";
import { StepRow } from "../../new/page";

const t = {
	back: "← Positions",
	loading: "Reading the name, Aqua and Chainlink…",
	error: "Could not read this position.",
	range: "Range",
	price: "Price now",
	inRange: "in range — working",
	below: "below the range",
	above: "above the range",
	committed: "Committed",
	remaining: "Still to convert",
	converted: "Converted",
	received: "Received",
	expires: "Expires",
	strategy: "Aqua strategy",
	holder: "Owner",
	notMaker:
		"The Aqua maker of this strategy is not the name's owner — it was shipped by another wallet; balances shown are the owner's (zero).",
	unknownAmount:
		"This name was written before moor.amount existed; the converted share cannot be derived.",
	agent: "Agent",
	agentName: (n: string) => `Identity: ${n}`,
	silent: "The agent has never reported on this position. The position does not need it.",
	stale:
		"The agent's last reading is over an hour old — the position keeps working; the agent is the one that is quiet.",
	lastRead: (when: string) => `Last reading ${when}`,
	proposal: "Proposal",
	none: "No proposal.",
	invalid: "The agent wrote a proposal that does not validate; ignored.",
	accept: "Accept proposal",
	acceptHint: (n: number) =>
		`${n} signature${n === 1 ? "" : "s"}: the agent proposed; you decide, on the Ledger.`,
	accepted: (next: string | null) =>
		next ? `Done — the successor is ${next}` : "Done — position closed.",
	revoke: "Revoke agent",
	revokeHint: "One signature. The agent loses its only permission; the position keeps working.",
	close: "Close position",
	closeHint:
		"Two signatures: stop the order on Aqua, then remove the name. Your tokens were never anywhere else.",
	closed: "Position closed and name removed.",
	revoked: "Agent revoked.",
	failed: "The session stopped; nothing after the failed step was sent.",
	confirm: "Confirm on your Ledger…",
	needAccount: "Connect the account that owns this name to act.",
};

export default function PositionDetail() {
	const { label } = useParams<{ label: string }>();
	const h = useHolder();
	const q = usePosition(h.name, label);
	const price = usePrice();
	const setup = useSetupStatus(h.parentLabel);
	const session = useSignSession();
	const toast = useToast();
	const qc = useQueryClient();
	const [acting, setActing] = useState<"close" | "revoke" | "accept" | null>(null);
	const p = q.data;
	const tokenInAddr = p
		? (p.side === "buy" ? demoPair.quote : demoPair.base).address
		: demoPair.quote.address;
	const acct = useTokenAccount(h.address, tokenInAddr);
	const proposal = p?.agent.proposal && p.agent.proposal.kind !== "none" ? p.agent.proposal : null;
	const acceptCalls =
		p && proposal && setup.data?.resolver
			? acceptProposalCalls({
					view: p,
					proposal,
					pair: demoPair,
					names: { registry: p.registry, resolver: setup.data.resolver },
					allowance: acct.data?.allowance ?? 0n,
					now: Math.floor(Date.now() / 1000),
				})
			: null;
	const agentAddr = useQuery({
		queryKey: ["addr", p?.agentName],
		queryFn: () => readAddr(publicClient, p?.agentName ?? ""),
		enabled: !!p?.agentName,
	});
	const now = Date.now() / 1000;
	const canAct = !!h.accountId && h.nameMatches === true;

	const act = async (kind: "close" | "revoke" | "accept") => {
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
		const successor = calls.find((c) => c.kind === "createPosition")
			? calls.length > 2
				? nextName(p.label)
				: null
			: null;
		toast(
			ok ? "ok" : "error",
			ok
				? kind === "close"
					? t.closed
					: kind === "revoke"
						? t.revoked
						: t.accepted(successor)
				: t.failed,
		);
		await qc.invalidateQueries({ queryKey: ["position", h.name, label] });
		await qc.invalidateQueries({ queryKey: ["positions"] });
	};

	if (q.isLoading) return <p className="text-neutral-400 text-sm">{t.loading}</p>;
	if (q.isError || !p) return <Notice kind="error">{t.error}</Notice>;
	const tokenIn = p.side === "buy" ? demoPair.quote : demoPair.base;
	const tokenOut = p.side === "buy" ? demoPair.base : demoPair.quote;
	const cur = price.data?.price;
	const where =
		cur === undefined
			? ""
			: cur < Number(p.priceMin)
				? t.below
				: cur > Number(p.priceMax)
					? t.above
					: t.inRange;

	return (
		<>
			<Link href="/" className="text-neutral-400 text-sm hover:text-neutral-100">
				{t.back}
			</Link>
			<header className="flex items-center justify-between gap-3">
				<h1 className="font-semibold text-2xl tracking-tight">{p.name}</h1>
				<StateBadge state={p.state} />
			</header>
			<Card className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
				<Row
					k={t.range}
					v={`${p.side === "buy" ? "Buy" : "Sell"} ${fmtPrice(Number(p.priceMin))} – ${fmtPrice(Number(p.priceMax))} USDC/BTC`}
				/>
				<Row k={t.price} v={cur === undefined ? "…" : `${fmtPrice(cur)} · ${where}`} />
				<Row
					k={t.committed}
					v={p.amountKnown ? fmtAmount(p.amountIn ?? 0n, tokenIn.decimals, tokenIn.symbol) : "—"}
				/>
				<Row k={t.converted} v={p.amountKnown ? fmtPct(p.converted) : "—"} />
				<Row k={t.remaining} v={fmtAmount(p.balanceIn, tokenIn.decimals, tokenIn.symbol)} />
				<Row k={t.received} v={fmtAmount(p.balanceOut, tokenOut.decimals, tokenOut.symbol, 6)} />
				<Row k={t.expires} v={p.expiry ? fmtDate(p.expiry) : "—"} />
				<Row k={t.holder} v={short(p.holder)} />
				<div className="col-span-2 text-neutral-500 text-xs">
					{t.strategy}: <span className="font-mono">{short(p.strategyHash)}</span> ·{" "}
					<a
						className="underline"
						href={explorer("address", p.holder)}
						target="_blank"
						rel="noreferrer"
					>
						etherscan <ExternalLink className="inline h-3 w-3" aria-hidden />
					</a>
				</div>
			</Card>
			{!p.makerMatches ? <Notice kind="warn">{t.notMaker}</Notice> : null}
			{!p.amountKnown ? <Notice>{t.unknownAmount}</Notice> : null}

			<Card className="flex flex-col gap-2 text-sm">
				<h2 className="font-medium">{t.agent}</h2>
				<p className="text-neutral-500 text-xs">
					{t.agentName(p.agentName)}
					{agentAddr.data ? ` → ${short(agentAddr.data)}` : ""}
				</p>
				{p.agent.checkedAt ? (
					<>
						<p className="text-neutral-300">{t.lastRead(ago(p.agent.checkedAt, now))}</p>
						{now - p.agent.checkedAt > 3600 ? <Notice kind="warn">{t.stale}</Notice> : null}
						<dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-neutral-400 text-xs">
							{p.agent.price !== undefined ? <Row k="price" v={fmtPrice(p.agent.price)} /> : null}
							{p.agent.state ? <Row k="state" v={p.agent.state} /> : null}
							{p.agent.filled ? <Row k="filled" v={p.agent.filled} /> : null}
							{p.agent.fees ? <Row k="fees" v={p.agent.fees} /> : null}
						</dl>
						<h3 className="mt-1 font-medium">{t.proposal}</h3>
						{p.agent.proposalError ? <Notice kind="warn">{t.invalid}</Notice> : null}
						{p.agent.proposal ? (
							<div className="rounded-md border border-neutral-800 p-3">
								<p>
									<span className="font-medium">{p.agent.proposal.kind}</span>
									{p.agent.proposal.priceMin
										? ` · ${p.agent.proposal.priceMin} – ${p.agent.proposal.priceMax}`
										: ""}
								</p>
								<p className="text-neutral-400">{p.agent.proposal.reasoning}</p>
								{p.agent.simulation ? (
									<p className="text-neutral-500 text-xs">{p.agent.simulation}</p>
								) : null}
							</div>
						) : (
							<p className="text-neutral-500">{t.none}</p>
						)}
					</>
				) : (
					<p className="text-neutral-400">{t.silent}</p>
				)}
			</Card>

			{session.steps.length ? (
				<Card>
					<ol className="flex flex-col gap-2">
						{session.steps.map((s, i) => (
							<StepRow key={s.call.kind} i={i} step={s} />
						))}
					</ol>
				</Card>
			) : null}
			{!canAct ? <Notice>{t.needAccount}</Notice> : null}
			<div className="flex flex-wrap justify-end gap-3">
				<div className="flex flex-col items-end gap-1">
					<Button
						variant="ghost"
						onClick={() => act("revoke")}
						disabled={!canAct || session.running}
					>
						{acting === "revoke" && session.running ? t.confirm : t.revoke}
					</Button>
					<span className="text-neutral-500 text-xs">{t.revokeHint}</span>
				</div>
				<div className="flex flex-col items-end gap-1">
					<Button
						variant="danger"
						onClick={() => act("close")}
						disabled={!canAct || session.running || p.state === "closed"}
					>
						{acting === "close" && session.running ? t.confirm : t.close}
					</Button>
					<span className="text-neutral-500 text-xs">{t.closeHint}</span>
				</div>
			</div>
		</>
	);
}

function nextName(label: string): string {
	const m = label.match(/^(.*)-(\d+)$/);
	return m ? `${m[1]}-${Number(m[2]) + 1}` : `${label}-2`;
}

function Row({ k, v }: { k: string; v: string }) {
	return (
		<div className="flex flex-col">
			<dt className="text-neutral-500 text-xs">{k}</dt>
			<dd>{v}</dd>
		</div>
	);
}
