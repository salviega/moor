/**
 * The one viem client the Live App reads with (06 §3: viem only reads). Logs
 * are fetched in chunks because public RPCs cap the block range of eth_getLogs.
 */
import type { LabelRegisteredLog, LogsClient } from "@moor/core";
import { createPublicClient, http, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { env } from "./env";

export const publicClient: PublicClient = createPublicClient({
	chain: sepolia,
	transport: http(env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

/** ENSv2's Sepolia beta and Moor's registries are younger than this block. */
export const MOOR_FROM_BLOCK = 11_600_000n;
const CHUNK = 10_000n;

/** `listPositions` wants one getLogs; public RPCs want ranges of a few thousand blocks. */
export const logsClient: LogsClient = {
	async getLogs(args) {
		const latest = await publicClient.getBlockNumber();
		const start = args.fromBlock === "earliest" ? MOOR_FROM_BLOCK : args.fromBlock;
		const out: LabelRegisteredLog[] = [];
		for (let from = start; from <= latest; from += CHUNK) {
			const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;
			const logs = await publicClient.getLogs({
				address: args.address,
				event: args.event,
				fromBlock: from,
				toBlock: to,
			});
			for (const l of logs) out.push({ args: l.args, blockNumber: l.blockNumber });
		}
		return out;
	},
};
