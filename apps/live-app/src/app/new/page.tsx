"use client";

/**
 * Open a position → Review and sign (04 §4.1). One decision: what to buy or
 * sell, with how much, between which prices, until when. The frame is the
 * one an open position has — the live chart where the chart is, the numbers
 * in the side panel where the numbers are — so opening and moving a position
 * are one gesture learnt once. The range is drawn while the holder types or
 * drags; the review says in plain words what will happen, what will not, and
 * what each of the signatures on the Ledger does.
 */
import { type NewPositionPlan, planNewPosition } from "@moor/core";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { parseUnits } from "viem";
import { MarketChart } from "@/components/market-chart";
import { RangeRuler } from "@/components/range-ruler";
import { useToast } from "@/components/toast";
import { Button, Details, ExplorerLink, Field, inputClass, Notice, Panel } from "@/components/ui";
import { fmtAmount, fmtDate, fmtPrice, fmtUsd } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { btcDemo, demoPairs, explorer, resolveDemoPair } from "@/lib/pair";
import { usePrice, usePriceHistory, useSetupStatus, useTokenAccount } from "@/lib/queries";
import { type Step, useSignSession } from "@/lib/session";
import { NameField } from "../name-field";

const t = {
	title: "Open a position",
	editor: "Set it up",
	review: "Review and sign",
	asset: "Which asset",
	side: "What do you want to do",
	buy: (asset: string) => `Buy ${asset} if it dips`,
	sell: (asset: string) => `Sell ${asset} if it rises`,
	amount: (sym: string) => `Amount of ${sym} to commit`,
	balance: (b: string) => `In your wallet: ${b}. It stays there.`,
	low: "Range low",
	high: "Range high",
	unitPrice: (asset: string) => `USD per ${asset}`,
	fee: "Fee per trade",
	feeHint: "30 bps = 0.30 %. Takers pay it; it stays in your position.",
	days: "Runs for",
	daysUnit: "days",
	daysHint: (d: string) => `Order and name expire together on ${d}.`,
	label: "Name",
	labelHint: (parent: string) => `Becomes ⟨name⟩.${parent} — lowercase letters, digits, hyphens.`,
	next: "Review before signing",
	back: "Back to the form",
	preview: {
		eyebrow: "What you are setting up",
		buy: (asset: string, amt: string, hi: string, lo: string) =>
			`If ${asset} drops below ${hi}, ${amt} start buying, a little at a time, until ${lo}. Above ${hi} nothing happens and your tokens stay in your wallet.`,
		sell: (asset: string, amt: string, lo: string, hi: string) =>
			`If ${asset} rises above ${lo}, ${amt} start selling, a little at a time, until ${hi}. Below ${lo} nothing happens and your tokens stay in your wallet.`,
		far: (pct: string, dir: string) =>
			`Today the price is ${pct} ${dir} the range: the position would wait.`,
		inRange:
			"The price is inside the range today: the position would start working with the first trade.",
	},
	needSetup: {
		title: "This name is not set up for Moor yet",
		body: "Run first-time setup once; it takes a few minutes and a few signatures.",
		action: "See setup",
	},
	notYours:
		"The account you chose does not own this name, so signing would fail on chain. Choose the account that owns it.",
	connect: "Choose the Ledger Live account that owns this name to sign.",
	invalid: {
		label: "Use lowercase letters, digits and hyphens.",
		range: "The low end must be below the high end.",
		amount: "Enter an amount above zero.",
	},
	sign: "Sign and open the position",
	signing: "Confirm on your Ledger…",
	done: "Position open",
	viewIt: "Open its page",
	failed:
		"The session stopped. Nothing after the failed step was sent; what was sent is listed above.",
	head: {
		asset: "You commit",
		stays: "stays in your wallet",
		condition: "Trades only when",
		never: "Never",
	},
	never: [
		"Sells back what it bought. Whatever converts stays converted, even if the price returns.",
		"Moves your tokens anywhere. Aqua keeps a virtual balance; no Moor contract is ever the maker.",
		"Transfers the name. It belongs to this account and expires with the order.",
	],
	signatures: (n: number) =>
		n === 1
			? "1 signature — your account runs every step at once"
			: `${n} signatures, in this order`,
	ledger: "On your Ledger",
	blind: {
		title: "Your Ledger will show raw data for these signatures",
		body: "Moor's clear-signing descriptors exist and render on an emulated Ledger, but Ledger only shows them on a device once they are published in its registry. Until then, compare the contract address on the device with the one listed here before you approve.",
	},
	approvePermanent:
		"A standing permission: Aqua may move this token from your wallet when a trade fills. You can withdraw it any time from any wallet app.",
	reversible: {
		approve: "reversible (revoke the permission)",
		ship: "reversible (close the position)",
		createPosition: "reversible (remove the name)",
	},
	status: {
		pending: "waiting",
		signing: "confirm on your Ledger",
		sent: "sent, waiting for the block",
		confirmed: "confirmed",
		failed: "failed",
	},
	contract: "Contract",
};

const DAY = 86_400;
/** A range that means something for each asset on the day the form opens; the holder's own numbers win. */
const defaultRange: Record<"btc" | "eth", { priceMin: string; priceMax: string }> = {
	btc: { priceMin: "58000", priceMax: "62000" },
	eth: { priceMin: "2200", priceMax: "2400" },
};
type Form = {
	amount: string;
	priceMin: string;
	priceMax: string;
	feeBps: string;
	days: string;
	label: string;
};

export default function NewPosition() {
	const h = useHolder();
	const setup = useSetupStatus(h.parentLabel);
	const [assetId, setAssetId] = useState<"btc" | "eth">("btc");
	const demo = demoPairs.find((d) => d.id === assetId) ?? btcDemo;
	const price = usePrice(assetId);
	const history = usePriceHistory(assetId);
	const [side, setSide] = useState<"buy" | "sell">("buy");
	const tokenIn = side === "buy" ? demo.pair.quote : demo.pair.base;
	const acct = useTokenAccount(h.address, tokenIn.address);
	const [form, setForm] = useState<Form>({
		amount: "1000",
		...defaultRange.btc,
		feeBps: "30",
		days: "30",
		label: "",
	});
	const chooseAsset = (next: "btc" | "eth") => {
		const prev = defaultRange[assetId];
		// Untouched defaults follow the asset; anything the holder typed stays.
		if (form.priceMin === prev.priceMin && form.priceMax === prev.priceMax)
			setForm({ ...form, ...defaultRange[next] });
		setAssetId(next);
	};
	const [plan, setPlan] = useState<NewPositionPlan | null>(null);
	const [error, setError] = useState<string | null>(null);
	const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setForm({ ...form, [k]: e.target.value });

	const lo = Number(form.priceMin);
	const hi = Number(form.priceMax);
	const validRange = lo > 0 && hi > lo;
	const validLabel = /^[a-z0-9-]+$/.test(form.label.trim());
	const validAmount = Number(form.amount) > 0;
	const deadline = Math.floor(Date.now() / 1000) + Number(form.days || 0) * DAY;
	const p = price.data?.price;
	const amt = validAmount ? `${form.amount} ${tokenIn.symbol}` : `your ${tokenIn.symbol}`;
	const where =
		p && validRange
			? p > hi
				? t.preview.far(`${((p / hi - 1) * 100).toFixed(0)}%`, "above")
				: p < lo
					? t.preview.far(`${((1 - p / lo) * 100).toFixed(0)}%`, "below")
					: t.preview.inRange
			: "";

	const review = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!h.address) return setError(t.connect);
		if (!setup.data?.registry || !setup.data.resolver) return setError(t.needSetup.body);
		try {
			setPlan(
				planNewPosition({
					holder: h.address,
					pair: demo.pair,
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
						deadline,
					},
				}),
			);
		} catch (err) {
			setError(err instanceof Error ? (err.message.split("\n")[0] ?? "") : String(err));
		}
	};

	if (plan) return <Review plan={plan} price={p} onBack={() => setPlan(null)} />;

	const chart = (
		<MarketChart
			asset={assetId}
			priceMin={validRange ? lo : 0}
			priceMax={validRange ? hi : 1}
			side={side}
			oracle={price.data}
			history={history.data ?? []}
			onRangeChange={(min, max) =>
				setForm((f) => ({ ...f, priceMin: String(min), priceMax: String(max) }))
			}
		/>
	);
	const choice = (on: boolean) =>
		`min-h-11 flex-1 items-center justify-center gap-2 rounded-md border px-3 text-sm ${on ? "border-accent text-text" : "border-line-strong text-muted hover:text-text"}`;

	return (
		<div className="flex flex-col gap-3 xl:min-h-full">
			<header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
				<h1 className="font-semibold text-xl tracking-tight">{t.title}</h1>
				<NameField quiet />
			</header>
			{setup.data && (!setup.data.registry || !setup.data.resolver) ? (
				<Notice
					tone="warn"
					title={t.needSetup.title}
					action={
						<Link href="/setup" className="underline">
							{t.needSetup.action}
						</Link>
					}
				>
					{t.needSetup.body}
				</Notice>
			) : null}

			{/* Same frame as an open position: the chart where the chart is, the numbers where the numbers are. */}
			<form
				onSubmit={review}
				className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[3fr_2fr]"
			>
				<Panel tone="raised" className="flex min-h-[380px] flex-col gap-3 xl:min-h-0">
					{chart}
				</Panel>
				<Panel tone="raised" className="flex flex-col gap-3">
					<span className="eyebrow">{t.editor}</span>
					<fieldset className="flex flex-col gap-1.5">
						<legend className="text-muted text-sm">{t.asset}</legend>
						<div className="flex gap-2" role="radiogroup" aria-label={t.asset}>
							{demoPairs.map((d) => (
								<button
									key={d.id}
									type="button"
									role="radio"
									aria-checked={assetId === d.id}
									onClick={() => chooseAsset(d.id)}
									className={`flex ${choice(assetId === d.id)}`}
								>
									<img
										src={d.icon}
										alt=""
										width={18}
										height={18}
										className="h-[18px] w-[18px] rounded-full"
									/>
									{d.label}
								</button>
							))}
						</div>
					</fieldset>
					<fieldset className="flex flex-col gap-1.5">
						<legend className="text-muted text-sm">{t.side}</legend>
						<div className="flex gap-2" role="radiogroup" aria-label={t.side}>
							{(["buy", "sell"] as const).map((s) => (
								<button
									key={s}
									type="button"
									role="radio"
									aria-checked={side === s}
									onClick={() => setSide(s)}
									className={choice(side === s)}
								>
									{s === "buy" ? t.buy(demo.label) : t.sell(demo.label)}
								</button>
							))}
						</div>
					</fieldset>
					<Field
						label={t.amount(tokenIn.symbol)}
						unit={tokenIn.symbol}
						hint={
							acct.data
								? t.balance(fmtAmount(acct.data.balance, tokenIn.decimals, tokenIn.symbol))
								: undefined
						}
						error={!validAmount ? t.invalid.amount : undefined}
					>
						<input
							className={inputClass}
							inputMode="decimal"
							value={form.amount}
							onChange={set("amount")}
						/>
					</Field>
					<div className="grid grid-cols-2 gap-3">
						<Field
							label={t.low}
							unit={t.unitPrice(demo.label)}
							error={!validRange ? t.invalid.range : undefined}
						>
							<input
								className={inputClass}
								inputMode="decimal"
								value={form.priceMin}
								onChange={set("priceMin")}
							/>
						</Field>
						<Field label={t.high} unit={t.unitPrice(demo.label)}>
							<input
								className={inputClass}
								inputMode="decimal"
								value={form.priceMax}
								onChange={set("priceMax")}
							/>
						</Field>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Field label={t.fee} unit="bps" hint={t.feeHint}>
							<input
								className={inputClass}
								inputMode="numeric"
								value={form.feeBps}
								onChange={set("feeBps")}
							/>
						</Field>
						<Field label={t.days} unit={t.daysUnit} hint={t.daysHint(fmtDate(deadline))}>
							<input
								className={inputClass}
								inputMode="numeric"
								value={form.days}
								onChange={set("days")}
							/>
						</Field>
					</div>
					<Field
						label={t.label}
						hint={t.labelHint(h.name)}
						error={form.label && !validLabel ? t.invalid.label : undefined}
					>
						<input
							className={`${inputClass} font-sans`}
							value={form.label}
							onChange={set("label")}
							placeholder={`${assetId}-dip`}
							autoCapitalize="none"
							spellCheck={false}
						/>
					</Field>
					{error ? <Notice tone="error">{error}</Notice> : null}
					<div className="mt-auto flex justify-end pt-1">
						<Button
							type="submit"
							disabled={!validRange || !validLabel || !validAmount}
							reason={
								!validLabel
									? "Choose a name first."
									: !validRange
										? "Fix the range first."
										: undefined
							}
						>
							{t.next}
						</Button>
					</div>
				</Panel>
			</form>

			<div className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-[3fr_2fr]">
				<Panel className="flex flex-col gap-2">
					<span className="eyebrow">{t.preview.eyebrow}</span>
					<p className="text-text">
						{validRange
							? side === "buy"
								? t.preview.buy(demo.label, amt, fmtPrice(hi), fmtPrice(lo))
								: t.preview.sell(demo.label, amt, fmtPrice(lo), fmtPrice(hi))
							: t.invalid.range}
					</p>
					{where ? <p className="text-muted text-sm">{where}</p> : null}
				</Panel>
				<Panel className="flex flex-col gap-2">
					<span className="eyebrow">{t.head.never}</span>
					<ul className="flex flex-col gap-1 text-muted text-sm">
						{t.never.map((n) => (
							<li key={n} className="flex gap-2">
								<span aria-hidden className="text-dim">
									·
								</span>
								{n}
							</li>
						))}
					</ul>
				</Panel>
			</div>
		</div>
	);
}

function Review({
	plan,
	price,
	onBack,
}: {
	plan: NewPositionPlan;
	price: number | undefined;
	onBack: () => void;
}) {
	const h = useHolder();
	const session = useSignSession();
	const toast = useToast();
	const qc = useQueryClient();
	const [done, setDone] = useState(false);
	const { side, priceMin: lo, priceMax: hi, feeBps, deadline } = plan.params;
	const demo = resolveDemoPair(plan.tokenIn.address, plan.tokenOut.address);
	const raw = BigInt(plan.params.amountIn);
	const amount = fmtAmount(raw, plan.tokenIn.decimals, plan.tokenIn.symbol);
	const usd = price ? fmtUsd(raw, plan.tokenIn.decimals, side === "buy" ? 1 : price) : null;
	const canSign = !!h.accountId && h.nameMatches !== false && h.host !== "browser";
	const reason =
		h.host === "browser"
			? "Open Moor from Ledger Live to sign."
			: !h.accountId
				? t.connect
				: h.nameMatches === false
					? t.notYours
					: undefined;

	const sign = async () => {
		if (!h.accountId) return;
		const ok = await session.run(h.accountId, plan.calls, h.address);
		if (ok) {
			setDone(true);
			toast("ok", `${plan.name} is open`);
			await qc.invalidateQueries({ queryKey: ["positions"] });
		}
	};
	const steps = session.steps.length
		? session.steps
		: plan.calls.map((call): Step => ({ call, status: "pending" }));
	const failed = session.steps.some((s) => s.status === "failed");

	return (
		<>
			<button
				type="button"
				onClick={onBack}
				disabled={session.running}
				className="min-h-11 self-start text-muted text-sm hover:text-text"
			>
				← {t.back}
			</button>
			<h1 className="font-semibold text-2xl tracking-tight">{t.review}</h1>

			<Panel tone="raised" className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_1fr]">
				<div className="flex flex-col gap-1">
					<span className="eyebrow">{t.head.asset}</span>
					<span className="flex items-center gap-2">
						<img
							src={side === "buy" ? "/token-usdc.png" : demo.icon}
							alt=""
							width={22}
							height={22}
							className="h-[22px] w-[22px] shrink-0 rounded-full"
						/>
						<span className="num text-3xl text-text">{amount}</span>
					</span>
					<span className="num text-dim text-sm">
						{usd ? `≈ ${usd} · ` : ""}
						{t.head.stays}
					</span>
				</div>
				<div className="flex flex-col gap-1">
					<span className="eyebrow">{t.head.condition}</span>
					<span className="text-text">
						{side === "buy"
							? `${demo.label} is below ${fmtPrice(Number(hi))} USD`
							: `${demo.label} is above ${fmtPrice(Number(lo))} USD`}
					</span>
					<span className="text-dim text-sm">
						until {fmtPrice(Number(side === "buy" ? lo : hi))} · fee {(feeBps / 100).toFixed(2)} %
						per trade · until {fmtDate(deadline)}
					</span>
				</div>
				<div className="sm:col-span-2">
					<RangeRuler priceMin={Number(lo)} priceMax={Number(hi)} price={price} side={side} />
				</div>
			</Panel>

			<Panel className="flex flex-col gap-2">
				<span className="eyebrow">{t.head.never}</span>
				<ul className="flex flex-col gap-1.5 text-muted">
					{t.never.map((n) => (
						<li key={n} className="flex gap-2">
							<span aria-hidden className="text-dim">
								·
							</span>
							{n}
						</li>
					))}
				</ul>
			</Panel>

			<Panel className="flex flex-col gap-4">
				<span className="eyebrow">{t.signatures(steps.length || plan.calls.length)}</span>
				<ol className="flex flex-col gap-3">
					{steps.map((s, i) => (
						<StepRow key={s.call.kind} i={i} step={s} />
					))}
				</ol>
				<Notice tone="warn" title={t.blind.title}>
					{t.blind.body}
				</Notice>
			</Panel>

			{failed ? <Notice tone="error">{t.failed}</Notice> : null}
			<div className="flex flex-wrap items-center justify-end gap-3">
				{done ? (
					<Link href={`/positions/${plan.params.label}`}>
						<Button>{t.viewIt}</Button>
					</Link>
				) : (
					<Button onClick={sign} busy={session.running} disabled={!canSign} reason={reason}>
						{session.running ? t.signing : t.sign}
					</Button>
				)}
			</div>
			<Details>
				<span>strategyHash {plan.strategyHash}</span>
				{plan.calls.map((c) => (
					<span key={c.kind}>
						{c.kind} → <ExplorerLink kind="address" id={c.to} />
					</span>
				))}
			</Details>
		</>
	);
}

const verbs: Record<Step["call"]["kind"], string> = {
	approve: "Allow Aqua to spend this token",
	ship: "Open the position",
	createPosition: "Name it on ENS and write its records",
	dock: "Stop the order",
	unregister: "Remove the name",
	revokeAgent: "Revoke the agent",
	setupAgent: "Register the agent",
	batch: "Run every step at once, from your own account",
};

export function StepRow({ i, step }: { i: number; step: Step }) {
	const icon =
		step.status === "confirmed" ? (
			<Check className="h-4 w-4 text-good" aria-hidden />
		) : step.status === "failed" ? (
			<CircleAlert className="h-4 w-4 text-bad" aria-hidden />
		) : step.status === "pending" ? (
			<span className="num inline-block h-4 w-4 text-center text-dim text-xs leading-4">
				{i + 1}
			</span>
		) : (
			<Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
		);
	const note = step.call.kind === "approve" ? t.approvePermanent : null;
	const rev = (t.reversible as Record<string, string>)[step.call.kind];
	return (
		<li className="flex items-start gap-3">
			<span className="mt-1 w-4 shrink-0">{icon}</span>
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-text">{verbs[step.call.kind]}</span>
				<span className="text-dim text-xs">
					{t.ledger}: “{step.call.ledgerShows}” · {t.status[step.status]}
					{rev ? ` · ${rev}` : ""}
					{step.hash ? (
						<>
							{" · "}
							<a
								className="underline"
								href={explorer("tx", step.hash)}
								target="_blank"
								rel="noreferrer"
							>
								transaction
							</a>
						</>
					) : null}
					{step.error ? <span className="text-bad"> · {step.error}</span> : null}
				</span>
				{note ? <span className="text-muted text-xs">{note}</span> : null}
				<span className="num text-dim text-xs">
					{t.contract} <ExplorerLink kind="address" id={step.call.to} />
				</span>
			</div>
		</li>
	);
}
