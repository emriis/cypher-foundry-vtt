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
  await removeValidationWorkspace(workspace);
}
