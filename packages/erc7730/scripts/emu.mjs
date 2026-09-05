#!/usr/bin/env node
// Starts Speculos with the prebuilt Ethereum app (LedgerHQ/app-ethereum releases)
// and a fixed test seed. Speculos is not a wallet: this seed holds nothing.
//
//   pnpm ledger:emu                 # flex, API on :5001, APDU on :9999
//   pnpm ledger:emu -- --model nanox
//
// Prerequisites (06 §6): `python3 -m venv .venv && .venv/bin/pip install speculos`
// and the system package `qemu-user-static` (Speculos runs the app under qemu-arm).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const args = Object.fromEntries(
	process.argv
		.slice(2)
		.map((a) => a.replace(/^--/, "").split("="))
		.map(([k, v]) => [k, v ?? true]),
);

const APP_VERSION = "1.22.3";
const model = String(args.model ?? "flex");
const apiPort = String(args["api-port"] ?? "5001");
const apduPort = String(args["apdu-port"] ?? "9999");
// Speculos' own documented test mnemonic. Public. Never funded.
const SEED =
	"glory promote mansion idle axis finger extra february uncover one trip resource lawn turtle enact monster seven myth punch hobby comfort wild raise skin";

const speculos = resolve(root, ".venv/bin/speculos");
if (!existsSync(speculos)) {
	console.error(`Speculos not found at ${speculos}.`);
	console.error("  python3 -m venv .venv && .venv/bin/pip install speculos erc7730");
	process.exit(1);
}
if (spawnSync("which", ["qemu-arm-static"]).status !== 0) {
	console.error("qemu-arm-static not found — Speculos needs it to run the app.");
	console.error("  sudo apt install -y qemu-user-static");
	process.exit(1);
}

const dir = resolve(here, "../.speculos");
const elf = resolve(dir, `app-${APP_VERSION}-${model}.elf`);
if (!existsSync(elf)) {
	mkdirSync(dir, { recursive: true });
	console.error(`downloading ${elf}…`);
	const dl = spawnSync(
		"gh",
		[
			"release",
			"download",
			APP_VERSION,
			"--repo",
			"LedgerHQ/app-ethereum",
			"--pattern",
			`app-${APP_VERSION}-${model}.elf`,
			"--dir",
			dir,
		],
		{ stdio: "inherit" },
	);
	if (dl.status !== 0) process.exit(dl.status ?? 1);
}

console.error(
	`speculos: model=${model} api=http://127.0.0.1:${apiPort} apdu=tcp://127.0.0.1:${apduPort}`,
);
const child = spawn(
	speculos,
	[
		"--model",
		model,
		"--display",
		"headless",
		"--api-port",
		apiPort,
		"--apdu-port",
		apduPort,
		"--seed",
		SEED,
		elf,
	],
	{ stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
