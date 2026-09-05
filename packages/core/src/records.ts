/**
 * ENS text record keys (04 §3). Two namespaces on the same name: `moor.*` is
 * written only by the holder (MoorRegistrar refuses the agent's keys there);
 * `moor.agent.*` are the eight keys the agent may write, granted per key with
 * PermissionedResolver.authorizeTextRoles (05 §7). `moor.amount` arrived in
 * phase 3: the committed amount, so the converted fraction needs no event scan.
 */
import { z } from "zod";

export const positionRecordKeys = [
	"moor.version",
	"moor.strategy",
	"moor.program",
	"moor.pair",
	"moor.side",
	"moor.range",
	"moor.agent",
	"moor.amount",
] as const;
export type PositionRecordKey = (typeof positionRecordKeys)[number];

export const agentRecordKeys = [
	"moor.agent.checkedAt",
	"moor.agent.price",
	"moor.agent.state",
	"moor.agent.filled",
	"moor.agent.fees",
	"moor.agent.proposal",
	"moor.agent.reasoning",
	"moor.agent.simulation",
] as const;
export type AgentRecordKey = (typeof agentRecordKeys)[number];

/** `chainId:strategyHash`, the pointer from a name to its Aqua strategy. */
export const StrategyRecord = z.object({
	chainId: z.number().int().positive(),
	strategyHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});
export type StrategyRecord = z.infer<typeof StrategyRecord>;

export function encodeStrategyRecord(r: StrategyRecord): string {
	return `${r.chainId}:${r.strategyHash.toLowerCase()}`;
}

export function decodeStrategyRecord(value: string): StrategyRecord {
	const [chain, hash, ...rest] = value.split(":");
	if (rest.length > 0 || chain === undefined || hash === undefined) {
		throw new Error(`malformed moor.strategy record: ${value}`);
	}
	return StrategyRecord.parse({ chainId: Number(chain), strategyHash: hash });
}

/** What the agent is allowed to propose (04 §3). Validated before it is ever written. */
export const Proposal = z.object({
	kind: z.enum(["none", "widen", "narrow", "close", "renew"]),
	priceMin: z.string().optional(),
	priceMax: z.string().optional(),
	deadline: z.number().int().positive().optional(),
	reasoning: z.string().max(280),
});
export type Proposal = z.infer<typeof Proposal>;
