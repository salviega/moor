#!/usr/bin/env node
// Compares a fresh `ledger:screens` run with the committed captures. What must
// not change: the verdict of every signature and the screens the holder reads
// before "Hold to sign". The last two frames of a flow are the device's
// post-signature transition and depend on capture timing, so they are kept as
// evidence but not compared.
//
//   node scripts/screens-check.mjs            # run after `pnpm ledger:screens`
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const results = JSON.parse(readFileSync(resolve(pkg, "screens/results.json"), "utf8"));
const committed = JSON.parse(
	execSync("git show HEAD:packages/erc7730/screens/results.json", { cwd: pkg, encoding: "utf8" }),
);

const problems = [];
for (const r of results.results) {
	const was = committed.results.find((c) => c.kind === r.kind);
	if (!was) {
		problems.push(`${r.kind}: new signature, no committed verdict`);
		continue;
	}
	if (was.status !== r.status)
		problems.push(`${r.kind}: verdict changed ${was.status} → ${r.status}`);
	if (was.screens !== r.screens)
		problems.push(`${r.kind}: ${was.screens} screens committed, ${r.screens} rendered`);
}

// Frames: everything the holder reads before signing, i.e. all but the last two.
const changed = execSync("git diff --name-only -- screens", { cwd: pkg, encoding: "utf8" })
	.split("\n")
	.filter((f) => f.endsWith(".png"));
for (const f of changed) {
	const m = f.match(/screens\/([^/]+)\/(\d+)\.png$/);
	if (!m) continue;
	const kind = m[1];
	const frame = Number(m[2]);
	const total = results.results.find((r) => r.kind === kind)?.screens ?? 0;
	if (kind === "approve") continue; // Ledger's own ERC-20 flow, not ours to pin
	if (frame <= total - 2)
		problems.push(`${kind}: frame ${m[2]} changed (a screen the holder reads)`);
}

if (problems.length) {
	console.error(`ledger:screens check failed:\n  ${problems.join("\n  ")}`);
	process.exit(1);
}
console.log(
	`ledger:screens check ok — ${results.results.length} signatures, verdicts and readable frames unchanged`,
);
