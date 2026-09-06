/**
 * Writes flow/raw-flow.json: the six transactions the holder signs, as unsigned
 * EIP-1559 raw transactions on Sepolia, built by the same code the Live App
 * uses (@moor/core). screens.mjs renders each on the emulated device.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { demoFlow } from "@moor/core";

/** The demo holder (Ledger Live account 0, m/44'/60'/0'/0/0), its registry and resolver on Sepolia, and the agent's key. */
const flow = demoFlow({
	holder: "0xAA1aEf44DDE610F433f271C6A8749139DD5162E1",
	registry: "0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922",
	resolver: "0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3",
	agent: "0xf98dad9f1aa054cDEc857F9bB98f0be9B1f74B32",
});
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../flow/raw-flow.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(flow, null, "\t")}\n`);
console.log(`wrote ${flow.length} transactions to ${out}`);
