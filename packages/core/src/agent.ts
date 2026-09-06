/**
 * What the agent derives and writes (04 §4.4, 05 §8, 06 §5). Everything here is
 * deterministic and pure: thresholds, the reading, the fallback proposal, the
 * prompt for the model, the records and the one transaction that writes them.
 * The model, when called, only chooses between alternatives this code already
 * simulated — and its answer is validated against `Proposal` before anything
 * is written. The agent app is the loop around these functions.
 */
import { type Address, encodeFunctionData, formatUnits, type Hex, namehash } from "viem";
import { permissionedResolverAbi } from "./abi";
import type { AgentRecords, PositionView } from "./reads";
import type { Proposal, Trigger } from "./records";
import { type AgentRecordKey, agentRecordKeys } from "./records";
import { type Call, closeCalls, type Pair, planNewPosition } from "./session";

/** Thresholds v1, fixed and documented here (07 phase 4). */
export const THRESHOLDS = {
	/** A waiting position whose range is this far (fraction of price) from the price is "far". */
	farFromRangeFraction: 0.1,
	/** The name and the order expire within this many seconds. */
	expiringSeconds: 24 * 3600,
	/** A renewal proposes this much more time. */
	renewSeconds: 30 * 86_400,
	/** A widened range is placed this close to the price (fraction), on the side the position trades. */
	widenGapFraction: 0.02,
} as const;

export function detectTriggers(view: PositionView, price: number, now: number): Trigger[] {
	if (view.state === "closed") return [];
	const out: Trigger[] = [];
	if (view.state === "completed") out.push("completed");
	if (
		view.state !== "expired" &&
		view.expiry > 0 &&
		view.expiry - now < THRESHOLDS.expiringSeconds
	) {
		out.push("expiring");
	}
	if (view.state === "waiting") {
		const lo = Number(view.priceMin);
		const hi = Number(view.priceMax);
		const distance = price > hi ? (price - hi) / price : price < lo ? (lo - price) / price : 0;
		if (distance > THRESHOLDS.farFromRangeFraction) out.push("farFromRange");
	}
	return out;
}

/** One model call per proposal: a standing proposal for the same trigger is left alone. */
export function shouldPropose(triggers: Trigger[], current: AgentRecords): boolean {
	if (triggers.length === 0) return false;
	const standing = current.proposal?.trigger;
	return !standing || !triggers.includes(standing);
}

export interface Reading {
	checkedAt: string;
	price: string;
	state: string;
	filled: string;
}

export function buildReading(view: PositionView, price: number, now: number): Reading {
	return {
		checkedAt: String(now),
		price: price.toFixed(2),
		state: view.state,
		filled: `${(view.converted * 100).toFixed(1)}%`,
	};
}

const round = (n: number) => String(Math.round(n));

/** The proposal the agent writes when it cannot ask the model — the cut 07 allows. */
export function deterministicProposal(
	trigger: Trigger,
	view: PositionView,
	price: number,
	now: number,
): Proposal {
	if (trigger === "completed") {
		return {
			kind: "close",
			trigger,
			reasoning: "Everything committed is converted; the order has nothing left to do.",
		};
	}
	if (trigger === "expiring") {
		return {
			kind: "renew",
			trigger,
			deadline: now + THRESHOLDS.renewSeconds,
			reasoning:
				"The order and the name expire within a day; renewing keeps the same range working.",
		};
	}
	const width = Number(view.priceMax) - Number(view.priceMin);
	const gap = price * THRESHOLDS.widenGapFraction;
	// A buy waits below the price, a sell above it: move the range next to the price, keep its width.
	const [lo, hi] =
		view.side === "buy" ? [price - gap - width, price - gap] : [price + gap, price + gap + width];
	return {
		kind: "widen",
		trigger,
		priceMin: round(lo),
		priceMax: round(hi),
		reasoning: `The price is far from the range, so nothing trades; a range just ${view.side === "buy" ? "below" : "above"} the price starts working sooner.`,
	};
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** What would happen if the holder accepted — in words, with the numbers a holder needs (04 §3). */
export function simulate(view: PositionView, price: number, p: Proposal, pair: Pair): string {
	const tokenIn = view.side === "buy" ? pair.quote : pair.base;
	const left = `${Number(formatUnits(view.balanceIn, tokenIn.decimals)).toLocaleString("en-US")} ${tokenIn.symbol}`;
	switch (p.kind) {
		case "close":
			return `Close: trading stops, the name is removed, ${left} stay where they always were — in the wallet.`;
		case "renew":
			return `Renew: same range ${fmt(Number(view.priceMin))}–${fmt(Number(view.priceMax))}, ${left} still to convert, ${p.deadline ? Math.round((p.deadline - Date.now() / 1000) / 86_400) : 30} more days.`;
		case "widen":
		case "narrow": {
			const hi = Number(p.priceMax ?? view.priceMax);
			const lo = Number(p.priceMin ?? view.priceMin);
			const where =
				view.side === "buy"
					? `${((1 - hi / price) * 100).toFixed(1)}% below the price`
					: `${((lo / price - 1) * 100).toFixed(1)}% above the price`;
			return `${p.kind === "widen" ? "Move" : "Narrow"} the range to ${fmt(lo)}–${fmt(hi)} (${where}): close this position and open a new one with the ${left} left; two signatures to close, two to open.`;
		}
		default:
			return "No change.";
	}
}

/** The one call per proposal (06 §5): the reading and the code-simulated alternatives; the model picks and explains. */
export function proposalPrompt(
	view: PositionView,
	price: number,
	now: number,
	triggers: Trigger[],
	pair: Pair,
): { system: string; user: string } {
	const candidates = triggers.map((t) => deterministicProposal(t, view, price, now));
	const system = [
		"You are the watch agent of a Moor position: a one-directional range order on 1inch Aqua, signed once from a Ledger, named on ENS.",
		"You cannot move funds, change the strategy or sign anything; you only write a proposal the holder may accept on their Ledger. Never claim otherwise.",
		"Pick one of the candidate proposals or 'none', keep its numbers unless a better range is obvious, and explain in at most two sentences a holder can act on.",
		"Answer with the structured proposal only.",
	].join(" ");
	const user = JSON.stringify(
		{
			position: {
				name: view.name,
				side: view.side,
				range: { priceMin: view.priceMin, priceMax: view.priceMax },
				state: view.state,
				converted: view.converted,
				expiresInHours: Math.round((view.expiry - now) / 3600),
				remainingIn: formatUnits(
					view.balanceIn,
					(view.side === "buy" ? pair.quote : pair.base).decimals,
				),
			},
			price: { quotePerBase: price, source: "Chainlink BTC/USD Sepolia" },
			triggers,
			candidates: candidates.map((c) => ({ ...c, simulation: simulate(view, price, c, pair) })),
			kinds: ["none", "widen", "narrow", "close", "renew"],
		},
		null,
		1,
	);
	return { system, user };
}

/** The eight moor.agent.* values. Without a proposal, `none` is written so a reader knows the agent looked. */
export function agentRecordValues(
	reading: Reading,
	proposal?: Proposal,
	simulation?: string,
	fees = "n/a",
): Record<AgentRecordKey, string> {
	const p: Proposal = proposal ?? { kind: "none", reasoning: "Nothing to propose." };
	return {
		"moor.agent.checkedAt": reading.checkedAt,
		"moor.agent.price": reading.price,
		"moor.agent.state": reading.state,
		"moor.agent.filled": reading.filled,
		"moor.agent.fees": fees,
		"moor.agent.proposal": JSON.stringify(p),
		"moor.agent.reasoning": p.reasoning,
		"moor.agent.simulation": simulation ?? "",
	};
}

/** One transaction per cycle: every setText through the resolver's multicall. The only thing the agent ever signs. */
export function agentSetTextCall(
	resolver: Address,
	name: string,
	values: Record<AgentRecordKey, string>,
): { to: Address; data: Hex } {
	const node = namehash(name);
	const calls = agentRecordKeys.map((key) =>
		encodeFunctionData({
			abi: permissionedResolverAbi,
			functionName: "setText",
			args: [node, key, values[key]],
		}),
	);
	return {
		to: resolver,
		data: encodeFunctionData({
			abi: permissionedResolverAbi,
			functionName: "multicall",
			args: [calls],
		}),
	};
}

/** `btc-dip` → `btc-dip-2` → `btc-dip-3`: the successor of an accepted proposal keeps the label with a counter (04 §8). */
export function nextLabel(label: string): string {
	const m = label.match(/^(.*)-(\d+)$/);
	return m ? `${m[1]}-${Number(m[2]) + 1}` : `${label}-2`;
}

/** The signing session behind *Accept proposal*: close, and for widen/narrow/renew open the successor with what is left. */
export function acceptProposalCalls(input: {
	view: PositionView;
	proposal: Proposal;
	pair: Pair;
	names: { registry: Address; resolver: Address };
	allowance: bigint;
	now: number;
}): Call[] {
	const { view, proposal, pair } = input;
	const calls = closeCalls({
		strategyHash: view.strategyHash,
		tokens: [view.tokenIn, view.tokenOut],
		registry: view.registry,
		label: view.label,
	});
	if (proposal.kind === "close" || proposal.kind === "none") return calls;
	const plan = planNewPosition({
		holder: view.holder,
		pair,
		allowance: input.allowance,
		names: input.names,
		params: {
			parentName: view.name.slice(view.label.length + 1),
			label: nextLabel(view.label),
			side: view.side,
			priceMin: proposal.priceMin ?? view.priceMin,
			priceMax: proposal.priceMax ?? view.priceMax,
			amountIn: view.balanceIn.toString(),
			feeBps: 30,
			deadline: proposal.deadline ?? Math.max(view.expiry, input.now + THRESHOLDS.renewSeconds),
		},
	});
	return [...calls, ...plan.calls];
}
