/**
 * The SwapVM program Moor ships, built in TypeScript byte for byte the way
 * `packages/contracts/src/MoorProgram.sol` builds it (05 §1, §5b). The parity
 * test pins both to the same golden vectors; if they drift, the Live App would
 * show one program and sign another.
 *
 * Layout (byte offsets are the VM's program counter):
 *   0  Deadline(uint40)                       7 bytes
 *   7  JumpIfTokenIn(takerTokenIn, 38)       24 bytes   allowed direction jumps over the trap
 *  31  Deadline(0)                            7 bytes   wrong direction: DeadlineReached(0) — expired at epoch 0
 *  38  FeeFlatIn(uint24)                      5 bytes
 *  43  XYCConcentrateSwap(sqrtMin, sqrtMax)  66 bytes
 *
 * The trap is Deadline(0), not Revert: the official AquaSwapVMRouter does not
 * dispatch the Revert opcode (spec/feedback/01_1inch.md).
 */
import {
	type Address,
	concatHex,
	encodeAbiParameters,
	type Hex,
	keccak256,
	numberToHex,
	pad,
} from "viem";

/** SwapVM opcodes (lib/swap-vm/src/libs/OpcodeList.sol). */
export const Opcode = {
	Deadline: 0x20,
	JumpIfTokenIn: 0x31,
	XYCConcentrateSwap: 0x51,
	FeeFlatIn: 0x70,
} as const;

/** Offset of FeeFlatIn: 7 + 24 + 7. Must equal `MoorProgram.MAIN_PC`. */
export const MAIN_PC = 38;

/** The wrong direction lands on a deadline that has always been in the past. */
export const DIRECTION_TRAP = 0;

/** 100 % in SwapVM's fee units. */
export const FEE_BPS_ONE = 10_000_000;

export interface ProgramParams {
	tokenA: Address;
	tokenB: Address;
	takerTokenIn: Address;
	feeBps: number;
	deadline: number;
	sqrtPriceMin: bigint;
	sqrtPriceMax: bigint;
}

/** [opcode][argsLength][args] — InstructionBuilder.sol. Exported for its own test. */
export function instruction(opcode: number, args: Hex): Hex {
	const len = (args.length - 2) / 2;
	if (len >= 256) throw new Error(`instruction args too long: ${len}`);
	return concatHex([numberToHex(opcode, { size: 1 }), numberToHex(len, { size: 1 }), args]);
}

const u = (n: bigint | number, size: number): Hex => numberToHex(n, { size });

export function buildProgram(p: ProgramParams): Hex {
	if (p.tokenA.toLowerCase() >= p.tokenB.toLowerCase())
		throw new Error("tokens must be sorted: tokenA < tokenB");
	const inPair = [p.tokenA, p.tokenB]
		.map((t) => t.toLowerCase())
		.includes(p.takerTokenIn.toLowerCase());
	if (!inPair) throw new Error("takerTokenIn must be one of the pair");
	if (!(0n < p.sqrtPriceMin && p.sqrtPriceMin < p.sqrtPriceMax))
		throw new Error("0 < sqrtPriceMin < sqrtPriceMax");
	if (p.feeBps < 0 || p.feeBps >= FEE_BPS_ONE) throw new Error("feeBps out of range");
	if (p.deadline <= 0 || p.deadline >= 2 ** 40) throw new Error("deadline out of range");

	return concatHex([
		instruction(Opcode.Deadline, u(p.deadline, 5)),
		instruction(Opcode.JumpIfTokenIn, concatHex([p.takerTokenIn, u(MAIN_PC, 2)])),
		instruction(Opcode.Deadline, u(DIRECTION_TRAP, 5)),
		instruction(Opcode.FeeFlatIn, u(p.feeBps, 3)),
		instruction(
			Opcode.XYCConcentrateSwap,
			concatHex([u(p.sqrtPriceMin, 32), u(p.sqrtPriceMax, 32)]),
		),
	]);
}

/** ISwapVM.Order for an Aqua-backed order without hooks (MakerTraitsLib.build). */
export interface Order {
	maker: Address;
	traits: bigint;
	data: Hex;
}

const USE_AQUA_INSTEAD_OF_SIGNATURE = 1n << 254n;
/** No hooks → every data-slice index is 40 (tokenA ‖ tokenB), packed as four uint16s, shifted to bit 160. */
const ORDER_DATA_INDEXES_NO_HOOKS = 0x0028002800280028n << 160n;

export function buildOrder(maker: Address, p: ProgramParams): Order {
	return {
		maker,
		traits: USE_AQUA_INSTEAD_OF_SIGNATURE | ORDER_DATA_INDEXES_NO_HOOKS, // receiver = 0 → the maker
		data: concatHex([p.tokenA, p.tokenB, buildProgram(p)]),
	};
}

/** `keccak256(abi.encode(order))` — Aqua's strategyHash and SwapVM.hash for Aqua orders. */
export function strategyHash(o: Order): Hex {
	return keccak256(
		encodeAbiParameters(
			[
				{
					type: "tuple",
					components: [{ type: "address" }, { type: "uint256" }, { type: "bytes" }],
				},
			],
			[[o.maker, o.traits, o.data]],
		),
	);
}

/** What Aqua receives in `ship(app, strategy, tokens, amounts)`. */
export function encodeStrategy(o: Order): Hex {
	return encodeAbiParameters(
		[{ type: "tuple", components: [{ type: "address" }, { type: "uint256" }, { type: "bytes" }] }],
		[[o.maker, o.traits, o.data]],
	);
}

// ---------------------------------------------------------------- prices

/** Floor integer square root, same result as OpenZeppelin's Math.sqrt. */
export function isqrt(n: bigint): bigint {
	if (n < 0n) throw new Error("isqrt of negative");
	if (n < 2n) return n;
	let x = BigInt(Math.floor(Math.sqrt(Number(n)))); // seed (≥ 1 for n ≥ 2); refined below
	for (;;) {
		const y = (x + n / x) >> 1n;
		if (y >= x) break;
		x = y;
	}
	while (x * x > n) x -= 1n;
	while ((x + 1n) * (x + 1n) <= n) x += 1n;
	return x;
}

/** Parses a positive decimal string into (numerator, 10^decimals). */
export function parseDecimal(s: string): { num: bigint; scale: bigint } {
	const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
	if (!m) throw new Error(`not a decimal: ${s}`);
	const frac = m[2] ?? "";
	return { num: BigInt(m[1] + frac), scale: 10n ** BigInt(frac.length) };
}

/**
 * SwapVM's sqrt price for a human quote-per-base price.
 *
 * XYCConcentrateSwap prices tokenB in units of tokenA (both raw), and takes
 * `sqrt(price) * 1e18`. A holder thinks in "quote per base" (USDC per BTC), and
 * the pair's decimals differ, so: with base = the token being bought and quote =
 * the token being spent, and `lower` = whichever of the two has the lower address,
 *
 *   priceBperA = (baseRaw / quoteRaw)              if base is tokenB
 *              = (quoteRaw / baseRaw)              if base is tokenA
 *
 * where `1 base = quotePerBase quote` fixes the raw ratio.
 */
export function sqrtPriceX18(input: {
	quotePerBase: string;
	baseDecimals: number;
	quoteDecimals: number;
	/** true when the base token has the greater address (is tokenB). */
	baseIsTokenB: boolean;
}): bigint {
	const { num, scale } = parseDecimal(input.quotePerBase);
	if (num === 0n) throw new Error("price must be positive");
	const baseRaw = 10n ** BigInt(input.baseDecimals) * scale; // 1 base, scaled by the price's decimals
	const quoteRaw = num * 10n ** BigInt(input.quoteDecimals); // quotePerBase quote, same scale
	const ONE36 = 10n ** 36n;
	// sqrt(priceBperA * 1e36) = sqrt(priceBperA) * 1e18
	return input.baseIsTokenB
		? isqrt((baseRaw * ONE36) / quoteRaw)
		: isqrt((quoteRaw * ONE36) / baseRaw);
}

/**
 * The two bounds for a position, ordered for the VM. Because priceBperA inverts
 * quotePerBase when the base is tokenB, "buy between 58k and 62k" becomes
 * sqrt(1/62k) … sqrt(1/58k); the smaller sqrt is always sqrtPriceMin.
 */
export function rangeToSqrtBounds(input: {
	priceMin: string;
	priceMax: string;
	baseDecimals: number;
	quoteDecimals: number;
	baseIsTokenB: boolean;
}): { sqrtPriceMin: bigint; sqrtPriceMax: bigint } {
	const a = sqrtPriceX18({ quotePerBase: input.priceMin, ...input });
	const b = sqrtPriceX18({ quotePerBase: input.priceMax, ...input });
	return a < b ? { sqrtPriceMin: a, sqrtPriceMax: b } : { sqrtPriceMin: b, sqrtPriceMax: a };
}

/** Sorts a pair by address the way SwapVM requires. */
export function sortPair(x: Address, y: Address): { tokenA: Address; tokenB: Address } {
	return x.toLowerCase() < y.toLowerCase() ? { tokenA: x, tokenB: y } : { tokenA: y, tokenB: x };
}

/** Left-pads a hex to 32 bytes (exported for tests). */
export const toBytes32 = (h: Hex) => pad(h, { size: 32 });
