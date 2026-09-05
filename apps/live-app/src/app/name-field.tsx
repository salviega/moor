"use client";

/** The holder's name and whether it resolves to the connected account — shown wherever the account matters. */
import { useState } from "react";
import { inputClass, Notice } from "@/components/ui";
import { short } from "@/lib/format";
import { useHolder } from "@/lib/holder";

const t = {
	label: "Your ENS name",
	change: "Change",
	save: "Use this name",
	noAccount: "Connect your Ledger Live account (top right) to sign; reading works without it.",
	mismatch: (addr: string) =>
		`This name resolves to ${addr}, not to the connected account. You can look, not sign.`,
	unresolved: "This name does not resolve on ENSv2 Sepolia.",
};

export function NameField() {
	const h = useHolder();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(h.name);
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="text-neutral-400">{t.label}:</span>
				{editing ? (
					<form
						className="flex gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							h.setName(draft);
							setEditing(false);
						}}
					>
						<input
							className={inputClass}
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
						/>
						<button type="submit" className="text-emerald-300 underline">
							{t.save}
						</button>
					</form>
				) : (
					<>
						<span className="font-medium">{h.name}</span>
						<button
							type="button"
							className="text-neutral-500 underline"
							onClick={() => setEditing(true)}
						>
							{t.change}
						</button>
					</>
				)}
			</div>
			{!h.address ? <Notice>{t.noAccount}</Notice> : null}
			{h.nameAddress === undefined && h.name ? <Notice kind="warn">{t.unresolved}</Notice> : null}
			{h.address && h.nameMatches === false && h.nameAddress ? (
				<Notice kind="warn">{t.mismatch(short(h.nameAddress))}</Notice>
			) : null}
		</div>
	);
}
