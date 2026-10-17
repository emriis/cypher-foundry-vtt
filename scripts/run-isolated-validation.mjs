/**
 * npm test entry point: normalize sources and run Node tests in a private copy.
 * The copy includes current edits, so validation tests the work in progress
 * without leaving generated source changes in the original checkout.
 */
import { spawn } from "node:child_process";
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
  await run(["scripts/run-tests.mjs", "all"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // Cleanup must also run after a failed migration or test process.
  await removeValidationWorkspace(workspace);
}
