/**
 * The EIP-7702 one-signature path on a physical Ledger (08 roadmap; the Speculos
 * half is packages/erc7730 `batch7702*`). Dev-only probe, outside the Live App on
 * purpose: Ledger Live's Wallet API signs neither a delegation authorization nor
 * a type-4 transaction, and its webview has no WebHID — so this page talks to the
 * device directly through the Device Management Kit, the way Streams verified on
 * this same Flex (github.com/JulioMCruz/Streams, web/src/lib/ledger-7702.ts).
 *
 * What it does, each behind a device tap: connect; dry-run the delegation
 * signature and check it recovers the device's address; delegate the EOA to the
 * one account contract the Ethereum app whitelists (Simple7702Account) with a
 * self-sponsored type-4 tx; send ONE ordinary transaction to self whose
 * `executeBatch` carries a whole Moor session (approve? · ship · createPosition),
 * built by the same @moor/core the Live App uses; undo the delegation.
 *
 * No key exists here. Nothing is sent that the device did not sign.
 */
import { DeviceActionStatus, DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import { webHidIdentifier, webHidTransportFactory } from "@ledgerhq/device-transport-kit-web-hid";
import {
	batchCall,
	btcPair,
	delegateOf,
	ensV2Sepolia,
	erc20Abi,
	moorSepolia,
	permissionedRegistryAbi,
	planNewPosition,
	SEPOLIA_CHAIN_ID,
	SIMPLE_7702_ACCOUNT,
	ZERO_ADDRESS,
} from "@moor/core";
import { firstValueFrom, type Observable } from "rxjs";
import {
	type Address,
	createPublicClient,
	formatUnits,
	type Hex,
	hexToBytes,
	http,
	parseUnits,
	serializeTransaction,
	type TransactionSerializable,
} from "viem";
import { sepolia } from "viem/chains";
import { recoverAuthorizationAddress } from "viem/utils";

/** Ledger Live account 0 — the demo holder (README). */
const DERIVATION_PATH = "44'/60'/0'/0/0";
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const ETHERSCAN = "https://sepolia.etherscan.io";

type Sig = { r: Hex; s: Hex; v: number };
type Signer = ReturnType<SignerEthBuilder["build"]>;

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
let signer: Signer | null = null;
let address: Address | null = null;

// ── DOM ──────────────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) => {
	const el = document.getElementById(id);
	if (!el) throw new Error(`missing #${id}`);
	return el as T;
};
const ui = {
	connect: $<HTMLButtonElement>("connect"),
	expected: $<HTMLInputElement>("expected"),
	address: $("address"),
	code: $("code"),
	balances: $("balances"),
	dryrun: $<HTMLButtonElement>("dryrun"),
	delegate: $<HTMLButtonElement>("delegate"),
	undelegate: $<HTMLButtonElement>("undelegate"),
	parent: $<HTMLInputElement>("parent"),
	label: $<HTMLInputElement>("label"),
	amount: $<HTMLInputElement>("amount"),
	batch: $<HTMLButtonElement>("batch"),
	log: $<HTMLPreElement>("log"),
};

function log(line: string, tone: "" | "ok" | "warn" | "bad" = ""): void {
	const at = new Date().toISOString().slice(11, 19);
	const span = document.createElement("span");
	if (tone) span.className = tone;
	span.textContent = `${at}  ${line}\n`;
	ui.log.append(span);
	ui.log.scrollTop = ui.log.scrollHeight;
}
function txLink(hash: Hex): string {
	return `${ETHERSCAN}/tx/${hash}`;
}
function setBusy(busy: boolean): void {
	for (const b of [ui.connect, ui.dryrun, ui.delegate, ui.undelegate, ui.batch]) {
		b.disabled = busy || (b !== ui.connect && !signer);
	}
}
/** DMK / WebHID errors are plain objects, not Error instances; never say "[object Object]". */
function reason(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (typeof e === "string") return e;
	if (e && typeof e === "object") {
		const o = e as Record<string, unknown>;
		const head = o.message ?? o._tag ?? o.errorCode ?? o.name;
		const cause = o.originalError ?? o.cause;
		const causeMsg =
			cause && typeof cause === "object" && "message" in cause
				? String((cause as { message: unknown }).message)
				: undefined;
		if (typeof head === "string")
			return causeMsg && causeMsg !== head ? `${head}: ${causeMsg}` : head;
		try {
			return JSON.stringify(e);
		} catch {
			/* circular */
		}
	}
	return String(e);
}

// ── Device ───────────────────────────────────────────────────────────────────
/** Drive a DMK device action to its terminal state. */
function runDeviceAction<T>(action: {
	observable: Observable<{ status: DeviceActionStatus; output?: T; error?: unknown }>;
}): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		action.observable.subscribe({
			next: (state) => {
				if (state.status === DeviceActionStatus.Completed) resolve(state.output as T);
				else if (state.status === DeviceActionStatus.Error) reject(state.error);
			},
			error: reject,
		});
	});
}

async function connect(): Promise<void> {
	if (!("hid" in navigator)) throw new Error("WebHID is not available: use Chrome or Edge");
	const dmk = new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build();
	log("Discovering a Ledger over WebHID… pick it in the browser prompt.");
	const device = await firstValueFrom(dmk.startDiscovering({ transport: webHidIdentifier }));
	const sessionId = await dmk.connect({ device });
	signer = new SignerEthBuilder({ dmk, sessionId }).build();
	const out = await runDeviceAction<{ address: Address }>(signer.getAddress(DERIVATION_PATH));
	address = out.address;
	ui.address.textContent = address;
	const expected = ui.expected.value.trim().toLowerCase();
	if (expected && expected !== address.toLowerCase()) {
		log(
			`Connected ${address} — NOT the expected holder ${ui.expected.value}. Check the device/account.`,
			"warn",
		);
	} else {
		log(`Connected ${address} (${DERIVATION_PATH})`, "ok");
	}
	await refresh();
}

async function refresh(): Promise<void> {
	if (!address) return;
	const [code, balance, allowance] = await Promise.all([
		publicClient.getCode({ address }),
		publicClient.readContract({
			address: moorSepolia.testUsdc,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [address],
		}),
		publicClient.readContract({
			address: moorSepolia.testUsdc,
			abi: erc20Abi,
			functionName: "allowance",
			args: [address, moorSepolia.aqua],
		}),
	]);
	const delegate = delegateOf(code);
	ui.code.textContent = delegate
		? `delegated → ${delegate}${delegate === SIMPLE_7702_ACCOUNT ? " (Simple7702Account ✓)" : " (unknown delegate!)"}`
		: code && code !== "0x"
			? `contract code (${(code.length - 2) / 2} bytes) — not a 7702 indicator`
			: "plain EOA (not delegated)";
	ui.balances.textContent = `${formatUnits(balance, 6)} tUSDC · allowance ${formatUnits(allowance, 6)} tUSDC`;
	ui.batch.disabled = !signer || delegate !== SIMPLE_7702_ACCOUNT;
}

/** Sign an unsigned serialized tx on the device and broadcast it. */
async function signAndSend(tx: TransactionSerializable, what: string): Promise<Hex> {
	if (!signer) throw new Error("not connected");
	const unsigned = serializeTransaction(tx);
	log(`${what}: review on the Flex — ${unsigned.length / 2 - 1} bytes, type ${tx.type}`);
	const sig = await runDeviceAction<Sig>(
		signer.signTransaction(DERIVATION_PATH, hexToBytes(unsigned)),
	);
	const signed = serializeTransaction(tx, {
		r: sig.r,
		s: sig.s,
		yParity: sig.v >= 27 ? sig.v - 27 : sig.v,
	});
	const hash = await publicClient.sendRawTransaction({ serializedTransaction: signed });
	log(`${what}: sent ${txLink(hash)}`, "ok");
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	log(
		`${what}: ${receipt.status} in block ${receipt.blockNumber}, gas ${receipt.gasUsed}`,
		receipt.status === "success" ? "ok" : "bad",
	);
	return hash;
}

async function signAuthorization(delegate: Address, nonce: number) {
	if (!signer) throw new Error("not connected");
	log(
		`Authorization: delegate ${delegate === ZERO_ADDRESS ? "0x0 (undo)" : delegate}, nonce ${nonce} — approve on the Flex`,
	);
	const sig = await runDeviceAction<Sig>(
		signer.signDelegationAuthorization(DERIVATION_PATH, SEPOLIA_CHAIN_ID, delegate, nonce),
	);
	return {
		chainId: SEPOLIA_CHAIN_ID,
		address: delegate,
		nonce,
		r: sig.r,
		s: sig.s,
		yParity: sig.v >= 27 ? sig.v - 27 : sig.v,
	} as const;
}

async function dryRun(): Promise<void> {
	if (!address) return;
	const nonce = await publicClient.getTransactionCount({ address, blockTag: "pending" });
	const authorization = await signAuthorization(SIMPLE_7702_ACCOUNT, nonce);
	const recovered = await recoverAuthorizationAddress({ authorization });
	const ok = recovered.toLowerCase() === address.toLowerCase();
	log(
		`Dry run: signature recovers ${recovered} → ${ok ? "matches the device" : "MISMATCH"}`,
		ok ? "ok" : "bad",
	);
	log("Nothing was broadcast.");
}

/** Self-sponsored type-4: the outer tx spends `nonce`, so the authorization carries `nonce + 1`. */
async function delegate(to: Address): Promise<void> {
	if (!address) return;
	const nonce = await publicClient.getTransactionCount({ address, blockTag: "pending" });
	const authorization = await signAuthorization(to, nonce + 1);
	const fees = await publicClient.estimateFeesPerGas();
	await signAndSend(
		{
			type: "eip7702",
			chainId: SEPOLIA_CHAIN_ID,
			nonce,
			to: address,
			value: 0n,
			data: "0x",
			authorizationList: [authorization],
			gas: 120_000n,
			maxFeePerGas: fees.maxFeePerGas,
			maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
		},
		to === ZERO_ADDRESS ? "Undo delegation" : "Delegate",
	);
	await refresh();
}

/** The Live App's own session (approve? · ship · createPosition), as one call to self. */
async function oneSignatureBatch(): Promise<void> {
	if (!address) return;
	const parentName = ui.parent.value.trim();
	const parentLabel = parentName.replace(/\.eth$/, "");
	const label = ui.label.value.trim();
	const amountIn = parseUnits(ui.amount.value.trim(), btcPair.quote.decimals).toString();
	const [registry, resolver, allowance] = await Promise.all([
		publicClient.readContract({
			address: ensV2Sepolia.ethRegistry,
			abi: permissionedRegistryAbi,
			functionName: "getSubregistry",
			args: [parentLabel],
		}),
		publicClient.readContract({
			address: ensV2Sepolia.ethRegistry,
			abi: permissionedRegistryAbi,
			functionName: "getResolver",
			args: [parentLabel],
		}),
		publicClient.readContract({
			address: moorSepolia.testUsdc,
			abi: erc20Abi,
			functionName: "allowance",
			args: [address, moorSepolia.aqua],
		}),
	]);
	if (registry === ZERO_ADDRESS || resolver === ZERO_ADDRESS) {
		throw new Error(
			`${parentName} has no Moor registry/resolver yet — run the Live App's setup first`,
		);
	}
	const plan = planNewPosition({
		holder: address,
		pair: btcPair,
		allowance,
		names: { registry, resolver },
		params: {
			parentName,
			label,
			side: "buy",
			priceMin: "58000",
			priceMax: "62000",
			amountIn,
			feeBps: 30,
			deadline: Math.floor(Date.now() / 1000) + 30 * 86_400,
		},
	});
	const batch = batchCall(address, plan.calls);
	log(`Batch: ${plan.calls.map((c) => c.kind).join(" · ")} → ${plan.name}`);
	log(
		`Ledger would show, with descriptors: "${batch.ledgerShows}" then ${plan.calls.map((c) => `"${c.ledgerShows}"`).join(", ")}`,
	);
	const [nonce, fees, gas] = await Promise.all([
		publicClient.getTransactionCount({ address, blockTag: "pending" }),
		publicClient.estimateFeesPerGas(),
		publicClient
			.estimateGas({ account: address, to: batch.to, data: batch.data })
			.then((g) => (g * 12n) / 10n)
			.catch((e) => {
				log(`estimateGas failed (${reason(e)}); using 1,500,000`, "warn");
				return 1_500_000n;
			}),
	]);
	await signAndSend(
		{
			type: "eip1559",
			chainId: SEPOLIA_CHAIN_ID,
			nonce,
			to: batch.to,
			value: 0n,
			data: batch.data,
			gas,
			maxFeePerGas: fees.maxFeePerGas,
			maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
		},
		`One signature (${plan.calls.length} calls)`,
	);
	log(`${plan.name} — check it in the Live App under Positions.`, "ok");
	await refresh();
}

// ── Wiring ───────────────────────────────────────────────────────────────────
function guard(fn: () => Promise<void>): () => void {
	return () => {
		setBusy(true);
		fn()
			.catch((e) => log(`✗ ${reason(e)}`, "bad"))
			.finally(() => {
				setBusy(false);
				refresh().catch(() => {});
			});
	};
}
ui.connect.addEventListener("click", guard(connect));
ui.dryrun.addEventListener("click", guard(dryRun));
ui.delegate.addEventListener(
	"click",
	guard(() => delegate(SIMPLE_7702_ACCOUNT)),
);
ui.undelegate.addEventListener(
	"click",
	guard(() => delegate(ZERO_ADDRESS)),
);
ui.batch.addEventListener("click", guard(oneSignatureBatch));
log("Ready. Close Ledger Live, open the Ethereum app on the Flex, then Connect.");
