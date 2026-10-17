/**
 * Run fast unit and behavior suites with coverage for loaded runtime modules.
 * Unimported runtime modules are absent from Node coverage; this is not a whole-system score.
 * The readable report goes to stdout; LCOV goes to ignored coverage/lcov.info.
 * This command does not normalize sources or build packs in the checkout.
 */
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { discoverTests } from "./test-suites.mjs";

mkdirSync("coverage", { recursive: true });

const testFiles = await discoverTests(path.resolve(import.meta.dirname, ".."), "runtime");

const args = [
  "--experimental-test-coverage",
  "--test-coverage-include=module/**/*.mjs",
  "--test-coverage-exclude=module/rules/**/*.test.mjs",
  "--test-reporter=spec",
  "--test-reporter=lcov",
  "--test-reporter-destination=stdout",
  "--test-reporter-destination=coverage/lcov.info",
  "--test",
  ...testFiles
];

const result = spawnSync(process.execPath, args, {
  stdio: "inherit"
});

process.exit(result.status ?? 1);
