/**
 * What do Ledger's servers know about what Moor signs? No device needed.
 *
 * The Ethereum signer of the DMK does not show the device anything it has not
 * fetched: before `signTransaction` it asks the ContextModule for the clear-sign
 * contexts of the transaction (descriptors from Ledger's CAL, proxy/delegate
 * resolution from its metadata service, trusted names, token metadata — all
 * PKI-signed) and streams them to the app. This script builds that same module
 * with the same defaults the probe page uses and asks it the same question, for
 * the four shapes that matter to the 08 §2.3 decision:
 *
 *   ship            → Aqua                 does Ledger have our ship descriptor?
 *   createPosition  → MoorRegistrar        …and createPosition?
 *   executeBatch    → the holder's EOA     the real EIP-7702 shape: is the delegate resolved?
 *   executeBatch    → Simple7702Account    the delegate itself: is there a batch descriptor?
 *
 *   pnpm --filter @moor/probe-7702 cal
 */
import {
	type ClearSignContext,
	ClearSignContextType,
	ContextModuleBuilder,
	ContextModuleChainID,
} from "@ledgerhq/context-module";
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { batchCall, demoFlowCalls, SEPOLIA_CHAIN_ID, SIMPLE_7702_ACCOUNT } from "@moor/core";

const holder = "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1" as const;
const calls = demoFlowCalls({
	holder,
	registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
	resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
	agent: "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32",
});
const ship = calls.find((c) => c.kind === "ship");
const createPosition = calls.find((c) => c.kind === "createPosition");
if (!ship || !createPosition) throw new Error("demo flow without ship/createPosition");
const batch = batchCall(holder, [ship, createPosition]);

/** Same defaults as the probe page: no origin token, production CAL, Ethereum. */
const contextModule = new ContextModuleBuilder({ originToken: "" })
	.setChain(ContextModuleChainID.Ethereum)
	.build();

/** A 4-byte challenge stands in for the one the device would issue; the servers answer regardless. */
const DUMMY_CHALLENGE = "00000000";

function describe(ctx: ClearSignContext): string {
	if (ctx.type === ClearSignContextType.ERROR) {
		return `error   ${String((ctx as { error?: { message?: string } }).error?.message ?? ctx)}`;
	}
	const payload = (ctx as { payload?: unknown }).payload;
	const size = typeof payload === "string" ? `${payload.length / 2 - 1} bytes` : typeof payload;
	const cert =
		"certificate" in ctx && (ctx as { certificate?: unknown }).certificate ? " +cert" : "";
	return `${ctx.type.padEnd(40)} ${size}${cert}`;
}

async function ask(
	label: string,
	to: `0x${string}`,
	data: `0x${string}`,
	chainId: number = SEPOLIA_CHAIN_ID,
): Promise<void> {
	console.log(
		`\n── ${label}\n   chain ${chainId}  to ${to}  selector ${data.slice(0, 10)}  ${data.length / 2 - 1} bytes`,
	);
	const contexts = await contextModule.getContexts({
		chainId,
		to,
		data,
		selector: data.slice(0, 10),
		value: 0n,
		from: holder,
		challenge: DUMMY_CHALLENGE,
		deviceModelId: DeviceModelId.FLEX,
	});
	if (contexts.length === 0) console.log("   (no contexts at all)");
	for (const ctx of contexts) console.log(`   ${describe(ctx)}`);
	const useful = contexts.filter((c) => c.type !== ClearSignContextType.ERROR);
	console.log(
		`   → ${useful.length} usable context(s)${useful.some((c) => c.type === ClearSignContextType.ETHEREUM_TRANSACTION_INFO) ? " — includes a TRANSACTION_INFO descriptor (clear-signable)" : ""}`,
	);
}

await ask("ship → Aqua", ship.to, ship.data);
await ask("createPosition → MoorRegistrar", createPosition.to, createPosition.data);
await ask(
	"executeBatch → the holder's EOA (delegated to Simple7702Account since 2026-09-06)",
	holder,
	batch.data,
);
await ask("executeBatch → Simple7702Account itself", SIMPLE_7702_ACCOUNT, batch.data);

// Does Ledger have a descriptor for the delegate on ANY network? Mainnet and Base (where Streams used it).
await ask("executeBatch → Simple7702Account on mainnet", SIMPLE_7702_ACCOUNT, batch.data, 1);
await ask("executeBatch → Simple7702Account on Base", SIMPLE_7702_ACCOUNT, batch.data, 8453);

// Positive control: a contract Ledger certainly describes — USDC.approve on mainnet — so an empty
// answer above means "no descriptor", not "the pipeline is broken".
await ask(
	"control: USDC.approve on mainnet",
	"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
	"0x095ea7b3000000000000000000000000b8747b3e2f90154420165fb2fc4707d63879714000000000000000000000000000000000000000000000000000000000000f4240",
	1,
);
