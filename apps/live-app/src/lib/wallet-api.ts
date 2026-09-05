/**
 * The one place the Live App talks to its host. Inside Ledger Live the host is
 * the Wallet API over window messages; in `pnpm dev` it is the simulator, so the
 * app runs without Ledger Live or a device (06 §3). Nothing here ever holds a key.
 */
import { WindowMessageTransport } from "@ledgerhq/wallet-api-client";
import { getSimulatorTransport, profiles } from "@ledgerhq/wallet-api-simulator";

export const useSimulator = process.env.NEXT_PUBLIC_WALLET_API_SIMULATOR === "1";

/** Ledger Live currency id for Ethereum Sepolia — the only chain during the hackathon (05 §1). */
export const SEPOLIA_CURRENCY_ID = "ethereum_sepolia";

export function createTransport() {
	if (useSimulator) {
		return { transport: getSimulatorTransport(profiles.STANDARD), disconnect: () => {} };
	}
	const transport = new WindowMessageTransport();
	transport.connect();
	return { transport, disconnect: () => transport.disconnect() };
}
