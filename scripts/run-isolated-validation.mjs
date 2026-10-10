/**
 * npm test entry point: normalize sources and run Node tests in a private copy.
 * The copy includes current edits, so validation tests the work in progress
 * without leaving generated source changes in the original checkout.
 */
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const { workspace, root } = await createValidationWorkspace(sourceRoot);

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`Validation exited with code ${code}`)));
  });
}

try {
  console.log("Running source normalization and tests in an isolated checkout.");
  // Normalize before execution because content tests read the source records.
  await run(["scripts/migrate-ability-sources.mjs"]);
  const folders = ["rules", "applications", "documents", "migrations", "content", "integration", "behaviors"];
  const files = [];
  for (const folder of folders) {
    for (const name of (await readdir(path.join(root, "tests", folder))).sort()) {
      if (name.endsWith(".test.mjs")) files.push(`tests/${folder}/${name}`);
    }
  }
  await run(["--test", "--test-reporter=spec", ...files]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // Cleanup must also run after a failed migration or test process.
  await removeValidationWorkspace(workspace);
}
