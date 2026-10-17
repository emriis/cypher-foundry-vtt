/** Classify every test once, including nested files; build and licensed live checks stay explicit. */
import { readdir } from "node:fs/promises";
import path from "node:path";

export const TEST_SUITES = {
  unit: ["rules", "applications", "documents", "data-models", "migrations"],
  behavior: ["behaviors"], content: ["content"], integration: ["integration"],
  sources: ["source-migrations"], build: ["build"], e2e: ["e2e"]
};
TEST_SUITES.runtime = [...TEST_SUITES.unit, ...TEST_SUITES.behavior];
TEST_SUITES.all = [...TEST_SUITES.runtime, ...TEST_SUITES.content,
  ...TEST_SUITES.integration, ...TEST_SUITES.sources];

/** Return sorted repository-relative paths, rejecting tests with no owning suite. */
export async function discoverTests(root, suite = "all") {
  const selected = TEST_SUITES[suite];
  if (!selected) throw new Error(`Unknown test suite: ${suite}`);
  const known = new Set(Object.values(TEST_SUITES).flat());
  const files = [];
  async function visit(directory, relative = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), name);
      else if (/\.(?:test|spec)\.mjs$/.test(entry.name)) {
        const family = name.split("/")[0];
        if (!known.has(family)) throw new Error(`Unclassified test: tests/${name}`);
        if (selected.includes(family)) files.push(`tests/${name}`);
      }
    }
  }
  await visit(path.join(root, "tests"));
  return files.sort();
}
