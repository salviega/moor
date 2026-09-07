"use client";

/**
 * Runs a signing session: one `Call` after another through the Wallet API,
 * each confirmed on the Ledger by the holder (04 §4.1 step 3). The app never
 * sees a key; it sees a hash. Under the simulator the hash is made up, so the
 * receipt wait is skipped there.
 *
 * One exception the holder opts into on chain (08 §2.3): an account delegated
 * with EIP-7702 to the account contract the Ledger app accepts signs a
 * multi-call session as ONE ordinary transaction to itself — `executeBatch`,
 * all or nothing, `msg.sender` still the holder inside every call. The app
 * only reads the account's code; it never delegates anything.
 */
import { useWalletAPIClient } from "@ledgerhq/wallet-api-client-react";
import { type Call, sessionCalls } from "@moor/core";
import BigNumber from "bignumber.js";
import { Buffer } from "buffer";
import { useCallback, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "./chain";
import { useSimulator } from "./wallet-api";

export type StepStatus = "pending" | "signing" | "sent" | "confirmed" | "failed";

export interface Step {
	call: Call;
	status: StepStatus;
	hash?: string;
	error?: string;
}

export function useSignSession() {
	const { client } = useWalletAPIClient();
	const [steps, setSteps] = useState<Step[]>([]);
	const [running, setRunning] = useState(false);

	const update = (i: number, patch: Partial<Step>) =>
		setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

	const run = useCallback(
		async (accountId: string, requested: Call[], holder?: Address | null): Promise<boolean> => {
			if (!client) throw new Error("Wallet API not connected");
			// A delegated account (EIP-7702 → Simple7702Account) signs the session as one batch.
			const code =
				holder && !useSimulator
					? await publicClient.getCode({ address: holder }).catch(() => undefined)
					: undefined;
			const calls = holder ? sessionCalls({ holder, code, calls: requested }) : requested;
			setSteps(calls.map((call) => ({ call, status: "pending" })));
			setRunning(true);
			try {
				for (let i = 0; i < calls.length; i++) {
					const call = calls[i] as Call;
					update(i, { status: "signing" });
					try {
						const hash = await client.transaction.signAndBroadcast(accountId, {
							family: "ethereum",
							amount: new BigNumber(0),
							recipient: call.to,
							data: Buffer.from(call.data.slice(2), "hex"),
						});
						update(i, { status: "sent", hash });
						if (!useSimulator) {
							const receipt = await publicClient.waitForTransactionReceipt({
								hash: hash as `0x${string}`,
							});
							if (receipt.status !== "success") {
								update(i, { status: "failed", error: "reverted on chain" });
								return false;
							}
						}
						update(i, { status: "confirmed" });
					} catch (e) {
						update(i, { status: "failed", error: e instanceof Error ? e.message : String(e) });
						return false;
					}
				}
				return true;
			} finally {
				setRunning(false);
			}
		},
		[client],
	);

	const reset = useCallback(() => setSteps([]), []);
	return { steps, running, run, reset };
}
