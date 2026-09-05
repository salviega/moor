"use client";

/**
 * Runs a signing session: one `Call` after another through the Wallet API,
 * each confirmed on the Ledger by the holder (04 §4.1 step 3). The app never
 * sees a key; it sees a hash. Under the simulator the hash is made up, so the
 * receipt wait is skipped there.
 */
import { useWalletAPIClient } from "@ledgerhq/wallet-api-client-react";
import type { Call } from "@moor/core";
import BigNumber from "bignumber.js";
import { Buffer } from "buffer";
import { useCallback, useState } from "react";
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
		async (accountId: string, calls: Call[]): Promise<boolean> => {
			if (!client) throw new Error("Wallet API not connected");
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
