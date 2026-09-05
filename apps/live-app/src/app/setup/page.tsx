"use client";

/**
 * First-time setup (04 §4.0): what exists under the holder's name and what does
 * not. The two proxies (registry, resolver) are paid for by anyone and created
 * by scripts in this phase; the holder's own signatures — pointing the name at
 * them, authorizing Moor, naming the agent — are SetupHolder.s.sol on the Ledger
 * until this screen signs them (the cut 07 allows for phase 3).
 */
import { Check, Circle } from "lucide-react";
import { Card, Notice } from "@/components/ui";
import { short } from "@/lib/format";
import { useHolder } from "@/lib/holder";
import { useSetupStatus } from "@/lib/queries";
import { NameField } from "../name-field";

const t = {
	title: "First-time setup",
	intro:
		"Positions live under your name, not under Moor's. Once per name, your name grows a registry (for the position names) and a resolver (for their records), Moor's registrar is allowed to create names there — and nothing else — and the agent gets its identity with a single permission.",
	steps: {
		registry: "A registry under your name",
		resolver: "A resolver of your own",
		moorRegistry: "Moor may create names in your registry (ROLE_REGISTRAR)",
		moorResolver: "Moor may write position records and hand the agent its keys",
		agent: "agent.<your name> exists with its eight moor.agent.* keys",
	},
	done: "Everything is in place.",
	howto: "Not there yet. Run once, from the repository:",
	loading: "Checking…",
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
			<p className="text-neutral-300 text-sm">{t.intro}</p>
			<NameField />
			<Card className="flex flex-col gap-2 text-sm">
				{s.isLoading ? <p className="text-neutral-400">{t.loading}</p> : null}
				{rows.map(([label, ok, addr]) => (
					<div key={label} className="flex items-center gap-2">
						{ok ? (
							<Check className="h-4 w-4 text-emerald-300" aria-hidden />
						) : (
							<Circle className="h-4 w-4 text-neutral-600" aria-hidden />
						)}
						<span>{label}</span>
						{addr ? (
							<span className="font-mono text-neutral-500 text-xs">{short(addr)}</span>
						) : null}
					</div>
				))}
			</Card>
			{complete ? <Notice>{t.done}</Notice> : null}
			{s.data && !complete ? (
				<Notice kind="warn">
					{t.howto}
					<pre className="mt-2 overflow-x-auto text-xs">{`MOOR_HOLDER=${h.address ?? "<your account>"} pnpm contracts:deploy:registrar
pnpm contracts:deploy:resolver
MOOR_AGENT=<agent key> forge script script/SetupHolder.s.sol --rpc-url $SEPOLIA_RPC_URL --ledger --hd-paths "m/44'/60'/0'/0/0" --broadcast`}</pre>
				</Notice>
			) : null}
		</>
	);
}
