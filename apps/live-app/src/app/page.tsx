import { SEPOLIA_CHAIN_ID } from "@moor/core";

export default function Home() {
	return (
		<main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
			<h1 className="text-3xl font-semibold tracking-tight">Moor</h1>
			<p className="text-neutral-400">
				Turn the waiting time of holding into productive capital. Sign once; the Ledger decides.
			</p>
			<p className="text-sm text-neutral-500">
				Phase 0 — empty Live App, wired for Ethereum Sepolia (chain {SEPOLIA_CHAIN_ID}). Positions
				arrive in phase 3.
			</p>
		</main>
	);
}
