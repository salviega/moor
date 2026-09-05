#!/usr/bin/env node
// Turns deployments/<chainId>.json (written by script/Deploy.s.sol) into the
// `moorSepolia` block of packages/core/src/addresses.ts. A deployment is a diff
// in that file plus tx hashes in the CHANGELOG (AGENTS.md). Zero addresses for
// Moor's own contracts are preserved until their phase deploys them.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
	process.argv
		.slice(2)
		.map((a) => a.replace(/^--/, "").split("="))
		.map(([k, v]) => [k, v ?? true]),
);
const chainId = String(args.chain ?? "11155111");
const out = resolve(args.out ?? resolve(here, "../../core/src/addresses.ts"));

const dep = JSON.parse(readFileSync(resolve(here, `../deployments/${chainId}.json`), "utf8"));
if (String(dep.chainId) !== chainId)
	throw new Error(`deployment chainId ${dep.chainId} != ${chainId}`);

const src = readFileSync(out, "utf8");
const blockRe =
	/(export const moorSepolia = \{\n)([\s\S]*?)(\n\} as const satisfies Record<string, Address>;)/;
const m = src.match(blockRe);
if (!m) throw new Error(`moorSepolia block not found in ${out}`);

const current = Object.fromEntries(
	[...m[2].matchAll(/^\s*(\w+):\s*("0x[0-9a-fA-F]{40}"|ZERO_ADDRESS),?$/gm)].map(([, k, v]) => [
		k,
		v,
	]),
);
const next = {
	...current,
	aqua: `"${dep.aqua}"`,
	swapVmRouter: `"${dep.swapVmRouter}"`,
	testWbtc: `"${dep.testWbtc}"`,
	testUsdc: `"${dep.testUsdc}"`,
};
const body = Object.entries(next)
	.map(([k, v]) => `\t${k}: ${v},`)
	.join("\n");
writeFileSync(out, src.replace(blockRe, `$1${body}$3`));
console.log(`wrote ${Object.keys(next).length} addresses for chain ${chainId} into ${out}`);
