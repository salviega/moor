import { SEPOLIA_CHAIN_ID } from "@moor/core";
import pino from "pino";
import { loadEnv } from "./env";

const log = pino({ name: "moor-agent" });
const once = process.argv.includes("--once");

async function cycle(): Promise<void> {
	// Phase 4 fills this in (07): read price and balances, deriveState(), write moor.agent.*.
	log.info({ chainId: SEPOLIA_CHAIN_ID }, "cycle: nothing to do yet — phase 4");
}

async function main(): Promise<void> {
	const env = loadEnv();
	log.info({ intervalSeconds: env.AGENT_INTERVAL_SECONDS, once }, "agent starting");
	await cycle();
	if (once) return;
	setInterval(() => {
		cycle().catch((err) => log.error({ err }, "cycle failed; position keeps working"));
	}, env.AGENT_INTERVAL_SECONDS * 1_000);
}

main().catch((err) => {
	log.fatal({ err }, "agent could not start");
	process.exit(1);
});
