import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");

async function collectModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectModules(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
      files.push(fullPath);
    }
  }

  return files;
}

const candidates = [
  path.join(ROOT, "cypher.mjs"),
  ...(await collectModules(path.join(ROOT, "module")))
].sort();

const failures = [];

for (const file of candidates) {
  try {
    await execFileAsync(process.execPath, ["--check", file], { cwd: ROOT });
  } catch (error) {
    failures.push({
      file: path.relative(ROOT, file),
      output: [error.stdout, error.stderr].filter(Boolean).join("\n").trim()
    });
  }
}

if (failures.length) {
  console.error(`Found ${failures.length} invalid system module(s):`);

  for (const failure of failures) {
    console.error(`\n--- ${failure.file} ---\n${failure.output}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    `System syntax check passed: ${candidates.length} .mjs files.`
  );
}
