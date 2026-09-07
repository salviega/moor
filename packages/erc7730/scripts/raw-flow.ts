/**
 * Writes flow/raw-flow.json: the six transactions the holder signs, as unsigned
 * EIP-1559 raw transactions on Sepolia, built by the same code the Live App
 * uses (@moor/core). screens.mjs renders each on the emulated device.
 *
 * PROBE (2026-09-06, not for merge as is): two extra transactions that answer
 * "what would the Flex show if ship + createPosition travelled in ONE
 * Simple7702Account.executeBatch, the EIP-7702 shape Streams verified on this
 * same device?" — see spec/definicion/08_roadmap.md and the session notes.
 *   batch7702Blind  → to = the holder (the real 7702 shape: a call to self); no
 *                     descriptor can match an EOA address → what a user sees today.
 *   batch7702Nested → to = Simple7702Account itself, with a descriptor whose
 *                     `calls.[].data` uses the ERC-7730 nested `calldata` format,
 *                     so the device may resolve our ship/createPosition descriptors
 *                     for the inner calls. Tests whether app 1.22.3 + the pinned
 *                     tester render nested calls at all.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { demoFlow, demoFlowCalls, type FlowTransaction, SEPOLIA_CHAIN_ID } from "@moor/core";

type Address = `0x${string}`;
type Hex = `0x${string}`;
// viem is core's dependency, not this package's; a probe borrows it from there.
const { encodeFunctionData, serializeTransaction } = createRequire(
	new URL("../../core/package.json", import.meta.url),
)("viem") as typeof import("viem");

/** The demo holder (Ledger Live account 0, m/44'/60'/0'/0/0), its registry and resolver on Sepolia, and the agent's key. */
const input = {
	holder: "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1" as Address,
	registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922" as Address,
	resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3" as Address,
	agent: "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32" as Address,
};
const flow = demoFlow(input);

// The only 7702 delegate the Ledger Ethereum app whitelists (eth-infinitism Simple7702Account);
// same bytecode on Sepolia and Base at this address.
const SIMPLE_7702_ACCOUNT: Address = "0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9";
const executeBatchAbi = [
	{
		type: "function",
		name: "executeBatch",
		stateMutability: "payable",
		inputs: [
			{
				name: "calls",
				type: "tuple[]",
				components: [
					{ name: "target", type: "address" },
					{ name: "value", type: "uint256" },
					{ name: "data", type: "bytes" },
				],
			},
		],
		outputs: [],
	},
] as const;

const inner = demoFlowCalls(input)
	.filter((c) => c.kind === "ship" || c.kind === "createPosition")
	.map((c) => ({ target: c.to, value: 0n, data: c.data }));
const batchData = encodeFunctionData({
	abi: executeBatchAbi,
	functionName: "executeBatch",
	args: [inner],
});

function probe(
	kind: string,
	to: Address,
	expectedStatus: FlowTransaction["expectedStatus"],
	title: string,
	nonce: number,
): FlowTransaction {
	return {
		kind,
		expectedTexts: [title],
		expectedStatus,
		description: `${kind}: ${title}`,
		txHash: `0x${nonce.toString(16).padStart(64, "0")}` as Hex,
		rawTx: serializeTransaction({
			type: "eip1559",
			chainId: SEPOLIA_CHAIN_ID,
			nonce,
			maxFeePerGas: 3_000_000_000n,
			maxPriorityFeePerGas: 1_000_000_000n,
			gas: 1_500_000n,
			to,
			value: 0n,
			data: batchData,
		}),
	} as unknown as FlowTransaction;
}

// Only with `pnpm ledger:screens -- --probe`: the flow's six captures and results.json never change.
if (process.env.PROBE_7702) {
	flow.push(
		probe("batch7702Blind", input.holder, "blind_signed", "Batch to self, no descriptor", 90),
		// Observed twice on 2026-09-06: every frame readable, inner calls rendered by our descriptors, and the
		// tester still says "partially" (the ??? testnet token amount, as with ship alone). Recorded as seen.
		probe(
			"batch7702Nested",
			SIMPLE_7702_ACCOUNT,
			"partially_clear_signed" as FlowTransaction["expectedStatus"],
			"Batch via delegate, nested",
			91,
		),
	);
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../flow/raw-flow.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(flow, null, "\t")}\n`);
console.log(`wrote ${flow.length} transactions to ${out}`);
