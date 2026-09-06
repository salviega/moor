"use client";

/**
 * First-time setup (04 §4.0). The decision: what does Moor get over my name,
 * and what does it not. The answer is a list a holder can verify on chain.
 */
import { Check, Circle } from "lucide-react";
import { Details, Notice, Panel, Skeleton } from "@/components/ui";
import { short } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { useSetupStatus } from "@/lib/queries";
import { NameField } from "../name-field";

const t = {
	title: "Setup",
	intro:
		"Positions live under your name, not under Moor's. Once per name, three things are created and one is allowed:",
	gets: [
		[
			"A registry under your name",
			"Position names are created here. You are its root; you can take everything back.",
		],
		[
			"A resolver of your own",
			"Position records live here. Only you write them — plus the agent, on its eight lines.",
		],
		[
			"Moor's registrar may create names",
			"That is the only permission Moor holds: create a name and write its first records. It cannot move tokens, transfer or remove a name, or change a record afterwards.",
		],
		[
			"The agent's identity",
			"agent.⟨your name⟩, with one permission: write moor.agent.* on your positions.",
		],
	],
	never:
		"Moor never holds your tokens, never gets an approval, is never the maker of your orders. The setup is a set of on-chain roles anyone can read.",
	status: "For this name",
	steps: {
		registry: "Registry under your name",
		resolver: "Resolver of your own",
		moorRegistry: "Moor may create names (ROLE_REGISTRAR)",
		moorResolver: "Moor may write first records and hand the agent its keys",
		agent: "agent.⟨name⟩ exists with its eight keys",
	},
	done: "Everything is in place. You can open positions.",
	howto: {
		title: "Not set up yet",
		body: "In this version the setup signatures run from the repository with your Ledger. It takes about five minutes.",
	},
	commands: "Commands",
};

export default function Setup() {
	const h = useHolder();
	const s = useSetupStatus(h.parentLabel);
	const rows: [string, boolean | undefined, string | null][] = s.data
		? [
				[t.steps.registry, !!s.data.registry, s.data.registry],
				[t.steps.resolver, !!s.data.resolver, s.data.resolver],
				[t.steps.moorRegistry, s.data.moorOnRegistry, null],
				[t.steps.moorResolver, s.data.moorOnResolver, null],
				[t.steps.agent, s.data.agentNamed, null],
			]
		: [];
	const complete = rows.length > 0 && rows.every(([, ok]) => ok);
	return (
		<>
			<h1 className="font-semibold text-2xl tracking-tight">{t.title}</h1>
			<NameField quiet />
			<p className="max-w-prose text-muted">{t.intro}</p>
			<ol className="flex flex-col gap-3">
				{t.gets.map(([head, body], i) => (
					<li key={head} className="flex gap-3">
						<span className="num w-5 shrink-0 text-dim">{i + 1}</span>
						<div className="flex flex-col">
							<span className="text-text">{head}</span>
							<span className="text-muted text-sm">{body}</span>
						</div>
					</li>
				))}
			</ol>
			<p className="max-w-prose text-dim text-sm">{t.never}</p>

			<Panel tone="raised" className="flex flex-col gap-2">
				<span className="eyebrow">{t.status}</span>
				{s.isLoading ? (
					<>
						<Skeleton className="h-5 w-64" />
						<Skeleton className="h-5 w-56" />
					</>
				) : null}
				{rows.map(([label, ok, addr]) => (
					<div key={label} className="flex min-h-8 items-center gap-2">
						{ok ? (
							<Check className="h-4 w-4 text-good" aria-label="done" />
						) : (
							<Circle className="h-4 w-4 text-dim" aria-label="not yet" />
						)}
						<span className={ok ? "text-text" : "text-muted"}>{label}</span>
						{addr ? <span className="num text-dim text-xs">{short(addr)}</span> : null}
					</div>
				))}
			</Panel>
			{complete ? <Notice tone="info">{t.done}</Notice> : null}
			{s.data && !complete ? (
				<Notice tone="warn" title={t.howto.title}>
					{t.howto.body}
				</Notice>
			) : null}
			<Details summary={t.commands}>
				<span>MOOR_HOLDER={h.address ?? "<your account>"} pnpm contracts:deploy:registrar</span>
				<span>pnpm contracts:deploy:resolver</span>
				<span>
					MOOR_AGENT=&lt;agent key&gt; forge script script/SetupHolder.s.sol --rpc-url
					$SEPOLIA_RPC_URL --ledger --hd-paths "m/44'/60'/0'/0/0" --broadcast
				</span>
			</Details>
		</>
	);
}
