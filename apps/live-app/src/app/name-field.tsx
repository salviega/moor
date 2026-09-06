"use client";

/**
 * Who the holder is, in ENS terms, and whether that matches the account that
 * will sign. Shown wherever the account matters; quiet when everything agrees.
 */
import { useState } from "react";
import { Button, inputClass, Notice } from "@/components/ui";
import { short } from "@/lib/format";
import { useHolder } from "@/lib/holder";

const t = {
	label: "Your name",
	change: "Change",
	save: "Use this name",
	cancel: "Cancel",
	browser: {
		title: "You are reading Moor outside Ledger Live",
		body: "Everything here is read from Sepolia and is safe to look at. To open, close or change a position you sign on your Ledger, so open Moor from Ledger Live (Discover → Moor).",
	},
	noAccount: "Choose your Ledger Live account (top right) to sign. Reading needs no account.",
	mismatch: (addr: string) =>
		`This name belongs to ${addr}, not to the account you chose. You can look, not sign. Choose the account that owns the name, or change the name.`,
	unresolved:
		"This name does not resolve on ENSv2 Sepolia. Check the spelling; it must end in .eth.",
};

export function NameField({ quiet = false }: { quiet?: boolean }) {
	const h = useHolder();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(h.name);
	const problem =
		h.host === "browser"
			? "browser"
			: h.nameAddress === undefined && h.name
				? "unresolved"
				: h.address && h.nameMatches === false && h.nameAddress
					? "mismatch"
					: !h.address && !quiet
						? "noAccount"
						: null;
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="eyebrow">{t.label}</span>
				{editing ? (
					<form
						className="flex flex-wrap items-center gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							h.setName(draft);
							setEditing(false);
						}}
					>
						<input
							className={`${inputClass} w-56`}
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							aria-label={t.label}
						/>
						<Button type="submit" variant="quiet" className="min-h-9">
							{t.save}
						</Button>
						<button
							type="button"
							className="min-h-9 text-dim underline"
							onClick={() => setEditing(false)}
						>
							{t.cancel}
						</button>
					</form>
				) : (
					<>
						<span className="text-text">{h.name}</span>
						<button
							type="button"
							className="min-h-9 text-dim underline hover:text-text"
							onClick={() => setEditing(true)}
						>
							{t.change}
						</button>
					</>
				)}
			</div>
			{problem === "browser" ? (
				<Notice tone="info" title={t.browser.title}>
					{t.browser.body}
				</Notice>
			) : problem === "unresolved" ? (
				<Notice tone="warn">{t.unresolved}</Notice>
			) : problem === "mismatch" && h.nameAddress ? (
				<Notice tone="warn">{t.mismatch(short(h.nameAddress))}</Notice>
			) : problem === "noAccount" ? (
				<Notice tone="info">{t.noAccount}</Notice>
			) : null}
		</div>
	);
}
