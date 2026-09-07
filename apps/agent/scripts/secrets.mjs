// Pushes the agent's secrets — and only those — from the git-ignored .env to the
// linked Supabase project (`supabase secrets set`). The deployer key and
// anything else in .env never leave this machine. Values are read into a
// temporary file that is deleted right after; nothing is printed.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ALLOWED = [
	"SEPOLIA_RPC_URL",
	"AGENT_PRIVATE_KEY",
	"GROQ_API_KEY",
	"AGENT_PARENT_NAME",
	"AGENT_MODEL",
	"AGENT_LOGS_CHUNK",
	"AGENT_FROM_BLOCK",
];

const envPath = resolve(process.cwd(), ".env");
let text;
try {
	text = readFileSync(envPath, "utf8");
} catch {
	console.error("no .env at the repository root — copy .env.example and fill the agent's lines");
	process.exit(1);
}
const picked = [];
for (const raw of text.split("\n")) {
	const line = raw.trim();
	if (!line || line.startsWith("#")) continue;
	const eq = line.indexOf("=");
	if (eq < 0) continue;
	const key = line.slice(0, eq).trim();
	let value = line.slice(eq + 1).trim();
	if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
	if (ALLOWED.includes(key) && value) picked.push(`${key}=${value}`);
}
const names = picked.map((p) => p.split("=")[0]);
for (const must of ["SEPOLIA_RPC_URL", "AGENT_PRIVATE_KEY"])
	if (!names.includes(must)) {
		console.error(`${must} is empty in .env; the agent cannot run without it`);
		process.exit(1);
	}

const dir = mkdtempSync(join(tmpdir(), "moor-agent-secrets-"));
const file = join(dir, "env");
try {
	writeFileSync(file, `${picked.join("\n")}\n`, { mode: 0o600 });
	console.log(`setting ${names.join(", ")} on the linked Supabase project`);
	const r = spawnSync("npx", ["--yes", "supabase@2.116.0", "secrets", "set", "--env-file", file], {
		stdio: "inherit",
	});
	process.exit(r.status ?? 1);
} finally {
	rmSync(dir, { recursive: true, force: true });
}
