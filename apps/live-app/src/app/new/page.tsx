"use client";

/**
 * New position → Review & sign (04 §4.1, §5). One form, validated by the shared
 * Zod schema through `planNewPosition`; the review says in plain words what will
 * and will not happen, lists every signature, then runs the session.
 */
import { type NewPositionPlan, planNewPosition } from "@moor/core";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { parseUnits } from "viem";
import { useToast } from "@/components/toast";
import { Button, Card, Field, inputClass, Notice } from "@/components/ui";
import { fmtAmount, fmtPrice } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { demoPair, explorer } from "@/lib/pair";
import { usePrice, useSetupStatus, useTokenAccount } from "@/lib/queries";
import { type Step, useSignSession } from "@/lib/session";
import { NameField } from "../name-field";

const t = {
	title: "New position",
	review: "Review & sign",
	side: "What do you want to do?",
	buy: "Buy BTC on a dip",
	sell: "Sell BTC on a rise",
	amount: (sym: string) => `Amount of ${sym} to commit`,
	balance: (b: string) => `Balance: ${b}`,
	priceMin: "Range: low (USDC per BTC)",
	priceMax: "Range: high (USDC per BTC)",
	priceNow: (p: string) =>
		`Current price ${p} (Chainlink). A range below it buys as the price falls; above it, the reverse.`,
	fee: "Your fee per trade (basis points)",
	feeHint: "30 = 0.30 %. Charged to takers on what they bring; it stays in your position.",
	days: "Runs for (days)",
	daysHint: "The order and the name expire together.",
	label: "Name",
	labelHint: (parent: string) => `Becomes <name>.${parent}. Lowercase letters, digits, hyphens.`,
	next: "Review",
	back: "Back",
	sign: "Sign with Ledger",
	signing: "Confirm on your Ledger…",
	done: "Position created",
	viewIt: "Open the position",
	needSetup: "First-time setup has not run for this name: no registry or resolver under it yet.",
	setup: "Go to setup",
	notYours: "The connected account does not own this name; signing would fail on chain.",
	connect: "Connect the Ledger Live account that owns this name to sign.",
	willHappen: "What will happen",
	wontHappen: "What will not happen",
	signatures: "Signatures, in order",
	ledger: "Ledger shows",
	explain: (amt: string, side: "buy" | "sell", lo: string, hi: string, fee: string) =>
		side === "buy"
			? `Your ${amt} stay in your wallet. When BTC drops below ${hi}, the position starts buying and earns ${fee} on each trade. If it reaches ${lo}, everything is converted to BTC — and stays BTC even if the price comes back up. If it never drops, nothing happens and you can close any time.`
			: `Your ${amt} stay in your wallet. When BTC rises above ${lo}, the position starts selling and earns ${fee} on each trade. If it reaches ${hi}, everything is converted to USDC — and stays USDC even if the price comes back down. If it never rises, nothing happens and you can close any time.`,
	wont: [
		"Nobody else can move these tokens: not Moor, not the agent. Aqua only holds a virtual balance; no Moor contract is ever the maker.",
		"The position only trades in one direction. Whatever it converts stays converted.",
		"The name expires with the order, and cannot be transferred.",
	],
	status: {
		pending: "waiting",
		signing: "confirm on your Ledger",
		sent: "sent, waiting for the block",
		confirmed: "confirmed",
		failed: "failed",
	},
};

const DAY = 86_400;

export default function NewPosition() {
	const h = useHolder();
	const price = usePrice();
	const setup = useSetupStatus(h.parentLabel);
	const [side, setSide] = useState<"buy" | "sell">("buy");
	const tokenIn = side === "buy" ? demoPair.quote : demoPair.base;
	const acct = useTokenAccount(h.address, tokenIn.address);
	const [form, setForm] = useState({
		amount: "1000",
		priceMin: "58000",
		priceMax: "62000",
		feeBps: "30",
		days: "30",
		label: "",
	});
	const [plan, setPlan] = useState<NewPositionPlan | null>(null);
	const [error, setError] = useState<string | null>(null);
	const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setForm({ ...form, [k]: e.target.value });

	const review = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!h.address) return setError(t.connect);
		if (!setup.data?.registry || !setup.data.resolver) return setError(t.needSetup);
		try {
			const p = planNewPosition({
				holder: h.address,
				pair: demoPair,
				allowance: acct.data?.allowance ?? 0n,
				names: { registry: setup.data.registry, resolver: setup.data.resolver },
				params: {
					parentName: h.name,
					label: form.label.trim(),
					side,
					priceMin: form.priceMin,
					priceMax: form.priceMax,
					amountIn: parseUnits(form.amount, tokenIn.decimals).toString(),
					feeBps: Number(form.feeBps),
					deadline: Math.floor(Date.now() / 1000) + Number(form.days) * DAY,
				},
			});
			setPlan(p);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	if (plan) return <Review plan={plan} onBack={() => setPlan(null)} />;

	return (
		<>
			<h1 className="font-semibold text-2xl tracking-tight">{t.title}</h1>
			<NameField />
			{setup.data && (!setup.data.registry || !setup.data.resolver) ? (
				<Notice kind="warn">
					{t.needSetup}{" "}
					<Link className="underline" href="/setup">
						{t.setup}
					</Link>
				</Notice>
			) : null}
			<form onSubmit={review} className="flex flex-col gap-4">
				<Card className="flex flex-col gap-4">
					<Field label={t.side}>
						<div className="flex gap-2">
							{(["buy", "sell"] as const).map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => setSide(s)}
									className={`rounded-md border px-3 py-2 text-sm ${side === s ? "border-emerald-400 text-emerald-300" : "border-neutral-700 text-neutral-300"}`}
								>
									{s === "buy" ? t.buy : t.sell}
								</button>
							))}
						</div>
					</Field>
					<Field
						label={t.amount(tokenIn.symbol)}
						hint={
							acct.data
								? t.balance(fmtAmount(acct.data.balance, tokenIn.decimals, tokenIn.symbol))
								: undefined
						}
					>
						<input
							className={inputClass}
							inputMode="decimal"
							value={form.amount}
							onChange={set("amount")}
						/>
					</Field>
					<div className="grid grid-cols-2 gap-3">
						<Field label={t.priceMin}>
							<input
								className={inputClass}
								inputMode="decimal"
								value={form.priceMin}
								onChange={set("priceMin")}
							/>
						</Field>
						<Field label={t.priceMax}>
							<input
								className={inputClass}
								inputMode="decimal"
								value={form.priceMax}
								onChange={set("priceMax")}
							/>
						</Field>
					</div>
					{price.data ? (
						<p className="text-neutral-500 text-xs">{t.priceNow(fmtPrice(price.data.price))}</p>
					) : null}
					<div className="grid grid-cols-2 gap-3">
						<Field label={t.fee} hint={t.feeHint}>
							<input
								className={inputClass}
								inputMode="numeric"
								value={form.feeBps}
								onChange={set("feeBps")}
							/>
						</Field>
						<Field label={t.days} hint={t.daysHint}>
							<input
								className={inputClass}
								inputMode="numeric"
								value={form.days}
								onChange={set("days")}
							/>
						</Field>
					</div>
					<Field label={t.label} hint={t.labelHint(h.name)}>
						<input
							className={inputClass}
							value={form.label}
							onChange={set("label")}
							placeholder="btc-dip"
						/>
					</Field>
				</Card>
				{error ? <Notice kind="error">{error}</Notice> : null}
				<div className="flex justify-end">
					<Button type="submit">
						{t.next} <ArrowRight className="h-4 w-4" aria-hidden />
					</Button>
				</div>
			</form>
		</>
	);
}

function Review({ plan, onBack }: { plan: NewPositionPlan; onBack: () => void }) {
	const h = useHolder();
	const session = useSignSession();
	const toast = useToast();
	const qc = useQueryClient();
	const [done, setDone] = useState(false);
	const amt = fmtAmount(BigInt(plan.params.amountIn), plan.tokenIn.decimals, plan.tokenIn.symbol);
	const { side, priceMin: lo, priceMax: hi, feeBps } = plan.params;

	const sign = async () => {
		if (!h.accountId) return;
		const ok = await session.run(h.accountId, plan.calls);
		if (ok) {
			setDone(true);
			toast("ok", `${plan.name} created`);
			await qc.invalidateQueries({ queryKey: ["positions"] });
		} else toast("error", "The session stopped; nothing after the failed step was sent.");
	};

	const canSign = !!h.accountId && h.nameMatches !== false;

	return (
		<>
			<h1 className="font-semibold text-2xl tracking-tight">{t.review}</h1>
			<Card className="flex flex-col gap-2">
				<h2 className="font-medium">{t.willHappen}</h2>
				<p className="text-neutral-300 text-sm">
					{t.explain(
						amt,
						side,
						fmtPrice(Number(lo)),
						fmtPrice(Number(hi)),
						`${(feeBps / 100).toFixed(2)} %`,
					)}
				</p>
				<h2 className="mt-2 font-medium">{t.wontHappen}</h2>
				<ul className="list-disc pl-5 text-neutral-300 text-sm">
					{t.wont.map((w) => (
						<li key={w}>{w}</li>
					))}
				</ul>
			</Card>
			<Card className="flex flex-col gap-3">
				<h2 className="font-medium">{t.signatures}</h2>
				<ol className="flex flex-col gap-2">
					{(session.steps.length
						? session.steps
						: plan.calls.map((call): Step => ({ call, status: "pending" }))
					).map((s, i) => (
						<StepRow key={s.call.kind} i={i} step={s} />
					))}
				</ol>
			</Card>
			{h.nameMatches === false ? <Notice kind="warn">{t.notYours}</Notice> : null}
			{!h.accountId ? <Notice>{t.connect}</Notice> : null}
			<div className="flex justify-between">
				<Button variant="ghost" onClick={onBack} disabled={session.running}>
					{t.back}
				</Button>
				{done ? (
					<Link href={`/positions/${plan.name.split(".")[0]}`}>
						<Button>{t.viewIt}</Button>
					</Link>
				) : (
					<Button onClick={sign} busy={session.running} disabled={!canSign}>
						{session.running ? t.signing : t.sign}
					</Button>
				)}
			</div>
		</>
	);
}

export function StepRow({ i, step }: { i: number; step: Step }) {
	const icon =
		step.status === "confirmed" ? (
			<Check className="h-4 w-4 text-emerald-300" aria-hidden />
		) : step.status === "failed" ? (
			<CircleAlert className="h-4 w-4 text-red-300" aria-hidden />
		) : step.status === "pending" ? (
			<span className="inline-block h-4 w-4 rounded-full border border-neutral-600" />
		) : (
			<Loader2 className="h-4 w-4 animate-spin text-neutral-300" aria-hidden />
		);
	return (
		<li className="flex items-start gap-3 text-sm">
			<span className="mt-0.5">{icon}</span>
			<div className="flex flex-col">
				<span>
					{i + 1}. {step.call.intent}
				</span>
				<span className="text-neutral-500 text-xs">
					{t.ledger}: “{step.call.ledgerShows}” · {t.status[step.status]}
					{step.hash ? (
						<>
							{" · "}
							<a
								className="underline"
								href={explorer("tx", step.hash)}
								target="_blank"
								rel="noreferrer"
							>
								tx
							</a>
						</>
					) : null}
					{step.error ? ` · ${step.error}` : null}
				</span>
			</div>
		</li>
	);
}
