/**
 * The one place the Live App talks to its host. Inside Ledger Live the host is
 * the Wallet API over window messages; in `pnpm dev` it is the simulator, so the
 * app runs without Ledger Live or a device (06 §3). Nothing here ever holds a key.
 */
import { deserializeAccount, WindowMessageTransport } from "@ledgerhq/wallet-api-client";
import { getSimulatorTransport, profiles } from "@ledgerhq/wallet-api-simulator";

export const useSimulator = process.env.NEXT_PUBLIC_WALLET_API_SIMULATOR === "1";

/** Ledger Live currency id for Ethereum Sepolia — the only chain during the hackathon (05 §1). */
export const SEPOLIA_CURRENCY_ID = "ethereum_sepolia";

/**
 * The simulator's STANDARD profile has no Sepolia account, so `pnpm dev` adds one:
 * the demo holder's address, so every read shows the real names and balances.
 * The simulator signs nothing — signAndBroadcast returns a made-up hash.
 */
const simulatorProfile = {
	...profiles.STANDARD,
	accounts: [
		...profiles.STANDARD.accounts,
		deserializeAccount({
			id: "account-sepolia-1",
			name: "Ethereum Sepolia 1 (simulator)",
			address: "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1",
			currency: SEPOLIA_CURRENCY_ID,
			balance: "1990000000000000000",
			spendableBalance: "1990000000000000000",
			blockHeight: 11643000,
			lastSyncDate: new Date().toISOString(),
		}),
	],
	currencies: [
		...profiles.STANDARD.currencies,
		{
			type: "CryptoCurrency",
			id: SEPOLIA_CURRENCY_ID,
			ticker: "ETH",
			name: "Ethereum Sepolia",
			family: "ethereum",
			color: "#0ebdcd",
			decimals: 18,
		},
	],
};

export function createTransport() {
	if (useSimulator) {
		return {
			transport: getSimulatorTransport(simulatorProfile as typeof profiles.STANDARD),
			disconnect: () => {},
		};
	}
	const transport = new WindowMessageTransport();
	transport.connect();
	return { transport, disconnect: () => transport.disconnect() };
}
