import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

mkdirSync("coverage", { recursive: true });

const testFiles = [
  "tests/rules/*.test.mjs",
  "tests/applications/*.test.mjs",
  "tests/documents/*.test.mjs",
  "tests/migrations/*.test.mjs",
  "tests/content/*.test.mjs",
  "tests/integration/*.test.mjs",
  "tests/behaviors/*.test.mjs"
];

const args = [
  "--experimental-test-coverage",
  "--test-coverage-include=module/rules/**/*.mjs",
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
