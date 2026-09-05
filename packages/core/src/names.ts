/**
 * ENSv2 names for positions (04 §3, 05 §7). Records are keyed by namehash and
 * live on the holder's PermissionedResolver; the holder's UserRegistry hangs
 * under their name in the ETHRegistry. Nothing here is hardcoded per holder:
 * registry and resolver are discovered on chain from the parent name.
 */
import { type Address, type Hex, keccak256, labelhash, namehash, stringToHex } from "viem";

/** The agent's label under the holder's name: `agent.<holder>.eth`. Mirrors MoorRegistrar.AGENT_LABEL. */
export const AGENT_LABEL = "agent";

/** Text keys the holder writes on a position (MoorRegistrar refuses anything else there). */
export const holderRecordKeys = [
	"moor.version",
	"moor.strategy",
	"moor.program",
	"moor.pair",
	"moor.side",
	"moor.range",
	"moor.agent",
] as const;

/** The eight keys the agent may write, on any name of the holder's resolver. Mirrors MoorRegistrar.agentKeys(). */
export const agentTextKeys = [
	"moor.agent.checkedAt",
	"moor.agent.price",
	"moor.agent.state",
	"moor.agent.filled",
	"moor.agent.fees",
	"moor.agent.proposal",
	"moor.agent.reasoning",
	"moor.agent.simulation",
] as const;

/** `<label>.<parentName>` as a string. */
export function fullName(parentName: string, label: string): string {
	return `${label}.${parentName}`;
}

/** namehash of `<label>.<parentName>` — same as MoorRegistrar.node(parentName, label). */
export function positionNode(parentName: string, label: string): Hex {
	return namehash(fullName(parentName, label));
}

/** DNS-encoded name (`\x07btc-dip\x08salviega\x03eth\x00`) — what NameCoder.encode produces and UniversalResolver takes. */
export function dnsEncode(name: string): Hex {
	if (name === "") return "0x00";
	let out = "0x";
	for (const label of name.split(".")) {
		if (label.length === 0 || label.length > 255) throw new Error(`bad label in ${name}`);
		out += label.length.toString(16).padStart(2, "0") + stringToHex(label).slice(2);
	}
	return `${out}00` as Hex;
}

/** PermissionedResolverLib.resource(node, part) — the EAC resource a role is granted on. */
export function resolverResource(node: Hex, part: Hex): bigint {
	if (BigInt(node) === 0n && BigInt(part) === 0n) return 0n;
	return BigInt(
		keccak256(`0x${node.slice(2).padStart(64, "0")}${part.slice(2).padStart(64, "0")}` as Hex),
	);
}

/** PermissionedResolverLib.partHash(string) — keccak256 of the key. */
export function textPart(key: string): Hex {
	return keccak256(stringToHex(key));
}

/** `ROLE_SET_TEXT` in PermissionedResolverLib. */
export const ROLE_SET_TEXT = 1n << 4n;

/**
 * The exact resources a judge can check: `resolver.hasRoles(resource, ROLE_SET_TEXT, agent)` is true for
 * these eight (any name, one key each) and false for everything else.
 */
export function agentResources(): { key: string; resource: bigint }[] {
	const zero = `0x${"0".repeat(64)}` as Hex;
	return agentTextKeys.map((key) => ({ key, resource: resolverResource(zero, textPart(key)) }));
}

/** The registry's anyId for a label is its labelhash (LibLabel.id). */
export function labelId(label: string): bigint {
	return BigInt(labelhash(label));
}

/** Registry role bitmaps used by Moor (RegistryRolesLib). */
export const RegistryRoles = {
	ROLE_REGISTRAR: 1n << 0n,
	ROLE_REGISTRAR_ADMIN: (1n << 0n) << 128n,
	ROLE_UNREGISTER: 1n << 12n,
	ROLE_RENEW: 1n << 16n,
	ROLE_SET_SUBREGISTRY: 1n << 20n,
	ROLE_SET_RESOLVER: 1n << 24n,
	ROLE_CAN_TRANSFER_ADMIN: (1n << 28n) << 128n,
} as const;

/** Value of `moor.pair`: `tokenIn:tokenOut` addresses, lowercase. */
export function encodePair(tokenIn: Address, tokenOut: Address): string {
	return `${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}

/** Value of `moor.range`: `priceMin:priceMax` in quote per base, as the holder typed them. */
export function encodeRange(priceMin: string, priceMax: string): string {
	return `${priceMin}:${priceMax}`;
}

export function decodeRange(value: string): { priceMin: string; priceMax: string } {
	const [priceMin, priceMax, ...rest] = value.split(":");
	if (rest.length > 0 || !priceMin || !priceMax)
		throw new Error(`malformed moor.range record: ${value}`);
	return { priceMin, priceMax };
}

/**
 * How the Live App lists a holder's positions (05 §11, closed in phase 2): the holder's registry emits
 * `LabelRegistered` with the label in clear text, so one `eth_getLogs` from the registry's creation
 * block is the whole index — no indexer, no `UniversalResolverV2` walk. Filtered to what MoorRegistrar
 * registered, minus the agent's name.
 */
export const labelRegisteredEvent = {
	type: "event",
	name: "LabelRegistered",
	inputs: [
		{ name: "tokenId", type: "uint256", indexed: true },
		{ name: "labelHash", type: "bytes32", indexed: true },
		{ name: "label", type: "string", indexed: false },
		{ name: "owner", type: "address", indexed: false },
		{ name: "expiry", type: "uint64", indexed: false },
		{ name: "sender", type: "address", indexed: false },
	],
} as const;

export interface RegisteredPosition {
	label: string;
	tokenId: bigint;
	owner: Address;
	expiry: bigint;
	blockNumber: bigint;
}

interface LabelRegisteredLog {
	args: {
		tokenId?: bigint;
		labelHash?: Hex;
		label?: string;
		owner?: Address;
		expiry?: bigint;
		sender?: Address;
	};
	blockNumber: bigint | null;
}

/** Pure part of `listPositions`: the latest registration per label, by MoorRegistrar, excluding the agent. */
export function positionsFromLogs(
	logs: readonly LabelRegisteredLog[],
	registrar: Address,
): RegisteredPosition[] {
	const byLabel = new Map<string, RegisteredPosition>();
	for (const { args, blockNumber } of logs) {
		if (args.sender?.toLowerCase() !== registrar.toLowerCase()) continue;
		if (args.label === undefined || args.label === AGENT_LABEL) continue;
		if (args.tokenId === undefined || args.owner === undefined || args.expiry === undefined)
			continue;
		byLabel.set(args.label, {
			label: args.label,
			tokenId: args.tokenId,
			owner: args.owner,
			expiry: args.expiry,
			blockNumber: blockNumber ?? 0n,
		});
	}
	return [...byLabel.values()].sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1));
}

/** The subset of viem's PublicClient this needs, so tests can stub it. */
export interface LogsClient {
	getLogs(args: {
		address: Address;
		event: typeof labelRegisteredEvent;
		fromBlock: bigint | "earliest";
		toBlock: "latest";
	}): Promise<readonly LabelRegisteredLog[]>;
}

export async function listPositions(
	client: LogsClient,
	params: { registry: Address; registrar: Address; fromBlock?: bigint },
): Promise<RegisteredPosition[]> {
	const logs = await client.getLogs({
		address: params.registry,
		event: labelRegisteredEvent,
		fromBlock: params.fromBlock ?? "earliest",
		toBlock: "latest",
	});
	return positionsFromLogs(logs, params.registrar);
}
