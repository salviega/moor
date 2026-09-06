"use client";

/**
 * A proposal is not an action. It is pending, it is the agent's, and it looks
 * like nothing that already happened: amber edge, "awaiting your signature",
 * two verbs. Dismissing is local — the agent's record stays on chain.
 */
import type { Proposal } from "@moor/core";
import type { ReactNode } from "react";
import { fmtPrice } from "@/lib/format";
import { Button } from "./ui";

const t = {
	eyebrow: "Agent proposal · awaiting your signature",
	verbs: {
		widen: "Move the range",
		narrow: "Narrow the range",
		close: "Close the position",
		renew: "Extend the position",
		none: "No change",
	},
	review: "Review and sign",
	dismiss: "Not now",
	writtenBy: (when: string) => `Written by the agent ${when}. It cannot act on it; only you can.`,
};

export function PendingBand({
	proposal,
	simulation,
	when,
	signatures,
	onReview,
	onDismiss,
	disabledReason,
	busy,
}: {
	proposal: Proposal;
	simulation?: string | undefined;
	when: string;
	signatures: number;
	onReview: () => void;
	onDismiss: () => void;
	disabledReason?: string | undefined;
	busy?: boolean;
}): ReactNode {
	const range =
		proposal.priceMin && proposal.priceMax
			? `${fmtPrice(Number(proposal.priceMin))} – ${fmtPrice(Number(proposal.priceMax))}`
			: "";
	return (
		<section
			className="flex flex-col gap-3 rounded-md border border-accent/50 border-l-4 border-l-accent bg-ink-1 p-4"
			aria-labelledby="proposal-title"
		>
			<span className="eyebrow text-accent">{t.eyebrow}</span>
			<h2 id="proposal-title" className="text-lg">
				{t.verbs[proposal.kind]}
				{range ? (
					<>
						{" to "}
						<span className="num">{range}</span>
					</>
				) : null}
			</h2>
			<p className="text-muted">{proposal.reasoning}</p>
			{simulation ? <p className="text-dim text-sm">{simulation}</p> : null}
			<p className="text-dim text-xs">{t.writtenBy(when)}</p>
			<div className="flex flex-wrap items-center gap-3">
				<Button onClick={onReview} disabled={!!disabledReason} reason={disabledReason} busy={busy}>
					{t.review} · {signatures} signature{signatures === 1 ? "" : "s"}
				</Button>
				<Button variant="quiet" onClick={onDismiss} disabled={busy}>
					{t.dismiss}
				</Button>
			</div>
		</section>
	);
}
