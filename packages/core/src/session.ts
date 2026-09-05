/**
 * A signing session is a list of calls the holder confirms one after the other
 * on the Ledger (04 §4.1, §4.5, §4.6). This module builds them; nothing here
 * signs or sends. Every `Call` maps to a function with an ERC-7730 descriptor
 * in packages/erc7730, and `ledgerShows` is the intent that descriptor declares.
 *
 * The parity test pins `planNewPosition` to the ship and createPosition
 * transactions that are on Sepolia: same strategyHash, same calldata.
 */
import { type Address, encodeFunctionData, formatUnits, type Hex } from "viem";
import { aquaAbi, erc20Abi, moorRegistrarAbi, permissionedRegistryAbi } from "./abi";
import { moorSepolia, SEPOLIA_CHAIN_ID } from "./addresses";
import { AGENT_LABEL, encodePair, encodeRange, fullName, labelId } from "./names";
import { type PositionParams, PositionParams as PositionParamsSchema } from "./position";
import {
	buildOrder,
	encodeStrategy,
	type Order,
	rangeToSqrtBounds,
	sortPair,
	strategyHash,
} from "./program";
import { encodeStrategyRecord } from "./records";

export type CallKind =
	| "approve"
	| "ship"
	| "createPosition"
	| "dock"
	| "unregister"
	| "revokeAgent"
	| "setupAgent";

export interface Call {
	kind: CallKind;
	to: Address;
	data: Hex;
	/** What is about to happen, in the holder's words. */
	intent: string;
	/** The ERC-7730 intent — what a clear-signing Ledger displays as the title. */
	ledgerShows: string;
}

export interface TokenInfo {
	address: Address;
	decimals: number;
	symbol: string;
}

/** The pair a position trades: base is what is bought or sold, quote is what it is priced in. */
export interface Pair {
	base: TokenInfo;
	quote: TokenInfo;
}

const MAX_UINT256 = 2n ** 256n - 1n;
/** SwapVM's fee unit is 1e7; the form speaks in basis points (1e4). */
const FEE_UNIT_PER_BPS = 1000;

export function approveCall(input: { token: Address; amount?: bigint; symbol?: string }): Call {
	const amount = input.amount ?? MAX_UINT256;
	return {
		kind: "approve",
		to: input.token,
		data: encodeFunctionData({
			abi: erc20Abi,
			functionName: "approve",
			args: [moorSepolia.aqua, amount],
		}),
		intent: `Allow Aqua to use your ${input.symbol ?? "tokens"} (once per token)`,
		ledgerShows: "Approve",
	};
}

export interface NewPositionInput {
	holder: Address;
	pair: Pair;
	params: PositionParams & { parentName: string };
	/** Current allowance of tokenIn for Aqua; decides whether an approve comes first. */
	allowance: bigint;
	/** The holder's registry and resolver under their name (first-time setup). */
	names?: { registry: Address; resolver: Address };
}

export interface NewPositionPlan {
	params: PositionParams & { parentName: string };
	order: Order;
	strategyHash: Hex;
	tokenIn: TokenInfo;
	tokenOut: TokenInfo;
	records: { key: string; value: string }[];
	registry: Address;
	resolver: Address;
	name: string;
	calls: Call[];
}

/** The seven records the holder signs on the name, in the order CreatePosition.s.sol writes them, plus moor.amount. */
export function positionRecords(input: {
	pair: Pair;
	params: PositionParams & { parentName: string };
	strategyHash: Hex;
	program: Hex;
}): { key: string; value: string }[] {
	const { params, pair } = input;
	const tokenIn = params.side === "buy" ? pair.quote : pair.base;
	const tokenOut = params.side === "buy" ? pair.base : pair.quote;
	return [
		{ key: "moor.version", value: "1" },
		{
			key: "moor.strategy",
			value: encodeStrategyRecord({ chainId: SEPOLIA_CHAIN_ID, strategyHash: input.strategyHash }),
		},
		{ key: "moor.program", value: input.program },
		{ key: "moor.pair", value: encodePair(tokenIn.address, tokenOut.address) },
		{ key: "moor.side", value: params.side },
		{ key: "moor.range", value: encodeRange(params.priceMin, params.priceMax) },
		{ key: "moor.agent", value: fullName(params.parentName, AGENT_LABEL) },
		{ key: "moor.amount", value: params.amountIn },
	];
}

const lower = (a: Address) => a.toLowerCase() as Address;

/**
 * approve (if needed) → ship → createPosition. Throws on an invalid form: the
 * Zod schema is the trust boundary, the same one the form validates against.
 */
export function planNewPosition(input: NewPositionInput): NewPositionPlan {
	const params = {
		...PositionParamsSchema.parse(input.params),
		parentName: input.params.parentName,
	};
	const { pair } = input;
	const tokenIn = params.side === "buy" ? pair.quote : pair.base;
	const tokenOut = params.side === "buy" ? pair.base : pair.quote;
	const { tokenA, tokenB } = sortPair(lower(pair.base.address), lower(pair.quote.address));
	const baseIsTokenB = lower(pair.base.address) === tokenB;
	const bounds = rangeToSqrtBounds({
		priceMin: params.priceMin,
		priceMax: params.priceMax,
		baseDecimals: pair.base.decimals,
		quoteDecimals: pair.quote.decimals,
		baseIsTokenB,
	});
	const order = buildOrder(input.holder, {
		tokenA,
		tokenB,
		takerTokenIn: lower(tokenOut.address),
		feeBps: params.feeBps * FEE_UNIT_PER_BPS,
		deadline: params.deadline,
		...bounds,
	});
	const hash = strategyHash(order);
	const amountIn = BigInt(params.amountIn);
	const amounts: [bigint, bigint] =
		lower(tokenIn.address) === tokenA ? [amountIn, 0n] : [0n, amountIn];
	const records = positionRecords({ pair, params, strategyHash: hash, program: order.data });
	const name = fullName(params.parentName, params.label);
	const registry =
		input.names?.registry ?? ("0x0000000000000000000000000000000000000000" as Address);
	const resolver =
		input.names?.resolver ?? ("0x0000000000000000000000000000000000000000" as Address);
	const pretty = `${formatUnits(amountIn, tokenIn.decimals)} ${tokenIn.symbol}`;

	const calls: Call[] = [];
	if (input.allowance < amountIn) {
		calls.push(approveCall({ token: tokenIn.address, symbol: tokenIn.symbol }));
	}
	calls.push({
		kind: "ship",
		to: moorSepolia.aqua,
		data: encodeFunctionData({
			abi: aquaAbi,
			functionName: "ship",
			args: [moorSepolia.swapVmRouter, encodeStrategy(order), [tokenA, tokenB], amounts],
		}),
		intent: `Open the position with ${pretty} — it stays in your wallet; Aqua only gets a virtual balance`,
		ledgerShows: "Open Moor position",
	});
	calls.push({
		kind: "createPosition",
		to: moorSepolia.moorRegistrar,
		data: encodeFunctionData({
			abi: moorRegistrarAbi,
			functionName: "createPosition",
			args: [registry, resolver, params.parentName, params.label, BigInt(params.deadline), records],
		}),
		intent: `Name it ${name} and write its records — the name expires with the position`,
		ledgerShows: "Name Moor position",
	});
	return {
		params,
		order,
		strategyHash: hash,
		tokenIn,
		tokenOut,
		records,
		registry,
		resolver,
		name,
		calls,
	};
}

/** dock on Aqua, then unregister the name: position and name die together (04 §4.5). */
export function closeCalls(input: {
	strategyHash: Hex;
	tokens: [Address, Address];
	registry: Address;
	label: string;
}): Call[] {
	return [
		{
			kind: "dock",
			to: moorSepolia.aqua,
			data: encodeFunctionData({
				abi: aquaAbi,
				functionName: "dock",
				args: [moorSepolia.swapVmRouter, input.strategyHash, input.tokens],
			}),
			intent: "Close the position — trading stops; your tokens were never anywhere else",
			ledgerShows: "Close Moor position",
		},
		{
			kind: "unregister",
			to: input.registry,
			data: encodeFunctionData({
				abi: permissionedRegistryAbi,
				functionName: "unregister",
				args: [labelId(input.label)],
			}),
			intent: `Remove the name ${input.label}`,
			ledgerShows: "Remove position name",
		},
	];
}

/** The kill switch (04 §4.6): the agent loses its only permission. */
export function revokeAgentCall(input: { resolver: Address; agent: Address }): Call {
	return {
		kind: "revokeAgent",
		to: moorSepolia.moorRegistrar,
		data: encodeFunctionData({
			abi: moorRegistrarAbi,
			functionName: "revokeAgent",
			args: [input.resolver, input.agent],
		}),
		intent: "Revoke the agent — it can no longer write its records; the position keeps working",
		ledgerShows: "Revoke Moor agent",
	};
}

/** First-time setup, last step: the agent's name and its eight keys (SetupHolder.s.sol). */
export function setupAgentCall(input: {
	registry: Address;
	resolver: Address;
	parentName: string;
	agent: Address;
	expiry: number;
}): Call {
	return {
		kind: "setupAgent",
		to: moorSepolia.moorRegistrar,
		data: encodeFunctionData({
			abi: moorRegistrarAbi,
			functionName: "setupAgent",
			args: [input.registry, input.resolver, input.parentName, input.agent, BigInt(input.expiry)],
		}),
		intent: `Register ${fullName(input.parentName, AGENT_LABEL)} and give the agent write access to its eight moor.agent.* keys only`,
		ledgerShows: "Authorize Moor agent",
	};
}
