#!/usr/bin/env node
// Phase 3 (07): renders every transaction of the flow on an emulated Ledger Flex
// with our ERC-7730 descriptors injected, and stores the screens under
// screens/<kind>/. CI diffs them: a descriptor change that alters a screen fails
// the build, not the demo.
//
//   pnpm ledger:screens                # all six; needs Docker and Node >= 24
//   pnpm ledger:screens -- --only=ship
//   pnpm ledger:screens -- --probe     # the EIP-7702 batch (08 §2.3): two extra transactions,
//                                      # captures under screens/batch7702*, results-probe.json
//
// Uses Ledger's own clear-signing tester (apps/clear-signing-tester in
// LedgerHQ/device-sdk-ts): it starts Speculos in Docker with the prebuilt
// Ethereum app (emu.mjs downloads it) and serves our unsigned descriptors to
// the app through its CAL interceptor — no PKI signature, no registry PR
// (spec/feedback/03_ledger.md). The checkout lives in .cs-tester/ (git-ignored)
// or wherever CS_TESTER_ROOT points.
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..");
const args = Object.fromEntries(
	process.argv
		.slice(2)
		.map((a) => a.replace(/^--/, "").split("="))
		.map(([k, v]) => [k, v ?? true]),
);
/** The EIP-7702 probes: not the flow, so they never touch the flow's captures or results.json. */
const probe = Boolean(args.probe);
const PROBE_KINDS = ["batch7702Blind", "batch7702Nested"];
const only = args.only ? String(args.only).split(",") : probe ? PROBE_KINDS : null;
const device = String(args.device ?? "flex");
const APP_VERSION = "1.22.3";
/** LedgerHQ/device-sdk-ts, develop — pinned to the commit this was built against. */
const TESTER_REPO = "https://github.com/LedgerHQ/device-sdk-ts.git";
const TESTER_COMMIT = "bb0cc89381ca7a4e297ed6bb801aa3e5ba9cf21f";
const TESTER_PNPM = "pnpm@10.34.4";

const fail = (msg) => {
	console.error(`ledger:screens: ${msg}`);
	process.exit(1);
};
const run = (cmd, argv, opts = {}) => {
	const r = spawnSync(cmd, argv, {
		stdio: opts.capture ? "pipe" : "inherit",
		encoding: "utf8",
		...opts,
	});
	if (r.status !== 0 && !opts.allowFail)
		fail(`${cmd} ${argv.slice(0, 3).join(" ")}… exited ${r.status}`);
	return r;
};

// 1. Preconditions: Node >= 24 (the tester's floor), Docker, the app ELF.
const major = Number(process.versions.node.split(".")[0]);
if (major < 24)
	fail(`Node >= 24 required by the clear-signing tester (nvm use 24); running ${process.version}`);
if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) fail("Docker is not running");
const elf = resolve(pkg, ".speculos", `app-${APP_VERSION}-${device}.elf`);
if (!existsSync(elf)) {
	mkdirSync(dirname(elf), { recursive: true });
	run("gh", [
		"release",
		"download",
		APP_VERSION,
		"--repo",
		"LedgerHQ/app-ethereum",
		"--pattern",
		`app-${APP_VERSION}-${device}.elf`,
		"--dir",
		dirname(elf),
	]);
}

// 2. The tester: clone (pinned) and build once.
const root = resolve(process.env.CS_TESTER_ROOT ?? resolve(pkg, ".cs-tester/device-sdk-ts"));
if (!existsSync(root)) {
	mkdirSync(dirname(root), { recursive: true });
	run("git", ["init", "-q", root]);
	run("git", ["-C", root, "fetch", "-q", "--depth", "1", TESTER_REPO, TESTER_COMMIT]);
	run("git", ["-C", root, "checkout", "-q", "FETCH_HEAD"]);
}
const tester = resolve(root, "apps/clear-signing-tester");
if (!existsSync(resolve(root, "node_modules"))) {
	run("npx", ["-y", TESTER_PNPM, "install", "--frozen-lockfile"], { cwd: root });
	run("npx", ["-y", TESTER_PNPM, "build:libs"], { cwd: root });
}

// 3. The transactions, from the same code the Live App signs with.
run("npx", ["tsx", resolve(here, "raw-flow.ts")], {
	cwd: pkg,
	env: { ...process.env, ...(probe ? { PROBE_7702: "1" } : {}) },
});
const flow = JSON.parse(readFileSync(resolve(pkg, "flow/raw-flow.json"), "utf8"));
// Every descriptor the holder can be asked to sign against, the batch's included: it is bound to
// Simple7702Account, so it never matches the six flow transactions and only renders under --probe.
const descriptors = readdirSync(resolve(pkg, "descriptors"))
	.filter((f) => f.endsWith(".json"))
	.map((f) => resolve(pkg, "descriptors", f));

// 4. One run per transaction, screens copied under screens/<kind>/.
const results = [];
let failed = 0;
for (const tx of flow) {
	if (only && !only.includes(tx.kind)) continue;
	const dir = resolve(pkg, "screens", tx.kind);
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	const tmp = resolve(pkg, ".cs-tester", `run-${tx.kind}`);
	rmSync(tmp, { recursive: true, force: true });
	mkdirSync(tmp, { recursive: true });
	writeFileSync(resolve(tmp, "tx.json"), JSON.stringify([tx]));
	spawnSync("sh", [
		"-c",
		"docker rm -f $(docker ps -aq --filter name=cs-tester) >/dev/null 2>&1 || true",
	]);
	const r = run(
		"npx",
		[
			"-y",
			TESTER_PNPM,
			"cli",
			"--device",
			device,
			"--custom-app",
			elf,
			"--erc7730-files",
			...descriptors,
			"--screenshot-folder-path",
			tmp,
			"--log-level",
			"warn",
			"raw-file",
			resolve(tmp, "tx.json"),
		],
		{
			cwd: tester,
			capture: true,
			allowFail: true,
			env: { ...process.env, COIN_APPS_PATH: dirname(elf) },
		},
	);
	const out = `${r.stdout}\n${r.stderr}`;
	// The results table has one row per transaction; the batch summary below it lists every status, so
	// only the row that names this transaction says what happened.
	const row = out.split("\n").find((l) => l.includes(tx.description)) ?? "";
	const status = /partially clear signed/i.test(row)
		? "partially_clear_signed"
		: /clear signed/i.test(row)
			? "clear_signed"
			: /blind signed/i.test(row)
				? "blind_signed"
				: "error";
	const shots = readdirSync(tmp)
		.filter((f) => f.endsWith(".png"))
		.sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
	shots.forEach((f, i) =>
		copyFileSync(resolve(tmp, f), resolve(dir, `${String(i + 1).padStart(2, "0")}.png`)),
	);
	const ok = status === tx.expectedStatus;
	if (!ok) failed++;
	results.push({
		kind: tx.kind,
		ledgerShows: tx.expectedTexts[0],
		status,
		expected: tx.expectedStatus,
		screens: shots.length,
	});
	console.log(
		`${ok ? "✓" : "✗"} ${tx.kind.padEnd(15)} ${status.padEnd(22)} ${shots.length} screens`,
	);
	if (status === "error") console.error(out.split("\n").slice(-30).join("\n"));
}
spawnSync("sh", [
	"-c",
	"docker rm -f $(docker ps -aq --filter name=cs-tester) >/dev/null 2>&1 || true",
]);
writeFileSync(
	resolve(pkg, probe ? "screens/results-probe.json" : "screens/results.json"),
	`${JSON.stringify({ device, appEthereum: APP_VERSION, tester: TESTER_COMMIT, results }, null, "\t")}\n`,
);
if (failed) fail(`${failed} transaction(s) did not render as expected`);
