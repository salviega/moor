"use client";

/**
 * Phase 0 diagnostic (07): does the Wallet API sign and broadcast an arbitrary
 * contract call on Sepolia from inside Ledger Live? The call is `mint(to, amount)`
 * on the demo tUSDC — 1,000 tUSDC to the connected account. No product logic;
 * this page goes away once phase 3 has real screens.
 */
import {
	useRequestAccount,
	useSignAndBroadcastTransaction,
} from "@ledgerhq/wallet-api-client-react";
import { moorSepolia } from "@moor/core";
import BigNumber from "bignumber.js";
import { Buffer } from "buffer";
import { encodeFunctionData, parseAbi } from "viem";
import { SEPOLIA_CURRENCY_ID, useSimulator } from "@/lib/wallet-api";

const testTokenAbi = parseAbi(["function mint(address to, uint256 amount)"]);
const MINT_AMOUNT = 1_000n * 10n ** 6n; // 1,000 tUSDC (6 decimals)

export default function SignTest() {
	const { requestAccount, account, pending: connecting, error: accountError } = useRequestAccount();
	const {
		signAndBroadcastTransaction,
		transactionHash,
		pending: signing,
		error: signError,
	} = useSignAndBroadcastTransaction();

	const connect = () => requestAccount({ currencyIds: [SEPOLIA_CURRENCY_ID] });

	const mint = () => {
		if (!account) return;
		const data = encodeFunctionData({
			abi: testTokenAbi,
			functionName: "mint",
			args: [account.address as `0x${string}`, MINT_AMOUNT],
		});
		return signAndBroadcastTransaction(account.id, {
			family: "ethereum",
			amount: new BigNumber(0),
			recipient: moorSepolia.testUsdc,
			data: Buffer.from(data.slice(2), "hex"),
		});
	};

	return (
		<main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Wallet API sign test</h1>
				<p className="text-sm text-neutral-400">
					Phase 0 diagnostic. Host: {useSimulator ? "simulator" : "Ledger Live"}. Chain: Ethereum
					Sepolia.
				</p>
			</header>

			<section className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-4">
				<h2 className="font-medium">1 · Account</h2>
				<button
					type="button"
					onClick={connect}
					disabled={connecting}
					className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
				>
					{connecting ? "Waiting for Ledger Live…" : "Select a Sepolia account"}
				</button>
				{account && (
					<p className="break-all font-mono text-xs text-neutral-300">
						{account.name} · {account.address}
					</p>
				)}
				{accountError ? <p className="text-xs text-red-400">{String(accountError)}</p> : null}
			</section>

			<section className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-4">
				<h2 className="font-medium">2 · Contract call</h2>
				<p className="text-xs text-neutral-400">
					<code>TestToken.mint(you, 1,000 tUSDC)</code> at{" "}
					<code className="break-all">{moorSepolia.testUsdc}</code>. Amount 0 ETH, data present —
					the thing being tested is that Ledger Live signs and broadcasts arbitrary calldata on
					Sepolia.
				</p>
				<button
					type="button"
					onClick={mint}
					disabled={!account || signing}
					className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
				>
					{signing ? "Confirm on your Ledger…" : "Sign & broadcast mint"}
				</button>
				{transactionHash && (
					<a
						className="break-all font-mono text-xs text-emerald-300 underline"
						href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
						target="_blank"
						rel="noreferrer"
					>
						{transactionHash}
					</a>
				)}
				{signError ? <p className="text-xs text-red-400">{String(signError)}</p> : null}
			</section>
		</main>
	);
}
