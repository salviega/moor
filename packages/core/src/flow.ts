/**
 * The demo flow as unsigned raw transactions: the six things the holder signs,
 * built by the same code the Live App uses, serialized for tools that render
 * them on an emulated device (packages/erc7730/scripts/screens.mjs). Nonce and
 * fees are nominal; only `to` and `data` matter to the screens.
 */
import { type Address, type Hex, serializeTransaction } from "viem";
import { moorSepolia, SEPOLIA_CHAIN_ID } from "./addresses";
import { type Call, closeCalls, type Pair, planNewPosition, revokeAgentCall } from "./session";

export interface FlowTransaction {
	kind: Call["kind"];
	/** What a clear-signing Ledger must show as the title. */
	expectedTexts: string[];
	/** approve is Ledger's own ERC-20 screen and needs the token in Ledger's CAL; testnet tokens are not there. */
	expectedStatus: "clear_signed" | "blind_signed";
	description: string;
	txHash: Hex;
	rawTx: Hex;
}

export interface FlowInput {
	holder: Address;
	registry: Address;
	resolver: Address;
	agent: Address;
	pair?: Pair;
}

export const demoPair: Pair = {
	base: { address: moorSepolia.testWbtc, decimals: 8, symbol: "tWBTC" },
	quote: { address: moorSepolia.testUsdc, decimals: 6, symbol: "tUSDC" },
};

/** approve → ship → createPosition → dock → unregister → revokeAgent, for a 1,000 tUSDC buy between 58k and 62k. */
export function demoFlowCalls(input: FlowInput): Call[] {
	const pair = input.pair ?? demoPair;
	const plan = planNewPosition({
		holder: input.holder,
		pair,
		allowance: 0n,
		names: { registry: input.registry, resolver: input.resolver },
		params: {
			parentName: "salviega.eth",
			label: "btc-dip",
			side: "buy",
			priceMin: "58000",
			priceMax: "62000",
			amountIn: "1000000000",
			feeBps: 30,
			deadline: 1791231936,
		},
	});
	return [
		...plan.calls,
		...closeCalls({
			strategyHash: plan.strategyHash,
			tokens: [pair.quote.address, pair.base.address],
			registry: input.registry,
			label: "btc-dip",
		}),
		revokeAgentCall({ resolver: input.resolver, agent: input.agent }),
	];
}

export function demoFlow(input: FlowInput): FlowTransaction[] {
	return demoFlowCalls(input).map((c, i) => ({
		kind: c.kind,
		expectedTexts: [c.ledgerShows],
		expectedStatus: c.kind === "approve" ? "blind_signed" : "clear_signed",
		description: `${c.kind}: ${c.ledgerShows}`,
		txHash: `0x${(i + 1).toString(16).padStart(64, "0")}` as Hex,
		rawTx: serializeTransaction({
			type: "eip1559",
			chainId: SEPOLIA_CHAIN_ID,
			nonce: i,
			maxFeePerGas: 3_000_000_000n,
			maxPriorityFeePerGas: 1_000_000_000n,
			gas: 400_000n,
			to: c.to,
			value: 0n,
			data: c.data,
		}),
	}));
}
