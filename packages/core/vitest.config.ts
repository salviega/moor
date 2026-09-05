import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["test/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			/**
			 * Coverage is measured over the logic we own. `addresses.ts` is data
			 * written by `contracts:deploy`, not logic — counting it would only
			 * dilute the number one way or the other.
			 */
			include: ["src/**/*.ts"],
			exclude: ["src/addresses.ts", "src/index.ts"],
			/**
			 * The floor from AGENTS.md. The command itself fails under it; there is
			 * no separate step that reads the percentage afterwards.
			 */
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 90,
				statements: 90,
			},
		},
	},
});
