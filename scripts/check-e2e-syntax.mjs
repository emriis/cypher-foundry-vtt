/** Parse every E2E module, including helpers which are not Playwright specs. */
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
async function modules(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await modules(filename));
    else if (entry.name.endsWith(".mjs")) files.push(filename);
  }
  return files;
}
for (const filename of ["scripts/run-foundry-e2e.mjs", "playwright.config.mjs",
  ...await modules(path.join(root, "tests/e2e"))]) {
  const result = spawnSync(process.execPath, ["--check", filename], { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
