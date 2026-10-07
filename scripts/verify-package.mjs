import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const manifest = path.join(root, "system.json");
const releaseManifest = path.join(dist, "system.json");
const archive = path.join(dist, "system.zip");
const requiredPaths = ["system.json", "cypher.mjs", "module", "templates", "css", "lang", "packs", "assets", "LICENSE.txt", "README.md"];

async function assertSameFile(left, right, label) {
  const [a, b] = await Promise.all([readFile(left), readFile(right)]);
  if (!a.equals(b)) throw new Error("Package mismatch: " + label);
}

async function listFiles(directory) {
  const result = [];
  async function walk(current, relative = "") {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const next = relative ? path.join(relative, entry.name) : entry.name;
      if (entry.isDirectory()) await walk(path.join(current, entry.name), next);
      else result.push(next.split(path.sep).join("/"));
    }
  }
  await walk(directory);
  return result.sort();
}

async function main() {
  await stat(releaseManifest);
  await stat(archive);
  await assertSameFile(manifest, releaseManifest, "dist/system.json");
  const staging = await mkdtemp(path.join(os.tmpdir(), "cypher-package-verify-"));
  try {
    await exec("unzip", ["-q", archive, "-d", staging]);
    const actualFiles = await listFiles(staging);
    const expectedFiles = [];
    for (const relativePath of requiredPaths) {
      const source = path.join(root, relativePath);
      if ((await stat(source)).isDirectory()) {
        for (const file of await listFiles(source)) {
          const basename = path.posix.basename(file);
          if (
            basename === "LOCK" ||
            basename === "LOG" ||
            basename === "LOG.old" ||
            basename.endsWith(".log")
          ) continue;
          expectedFiles.push(path.posix.join(relativePath, file));
        }
      } else expectedFiles.push(relativePath);
    }
    expectedFiles.sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      const actual = new Set(actualFiles);
      const expected = new Set(expectedFiles);
      const missing = expectedFiles.filter((file) => !actual.has(file));
      const unexpected = actualFiles.filter((file) => !expected.has(file));
      const details = [
        missing.length ? "Missing from archive:\\n" + missing.join("\\n") : "",
        unexpected.length ? "Unexpected in archive:\\n" + unexpected.join("\\n") : "",
      ].filter(Boolean).join("\\n");
      throw new Error("Package file list does not match the PR tree.\\n" + details);
    }
    for (const relativePath of expectedFiles) {
      await assertSameFile(
        path.join(root, relativePath),
        path.join(staging, relativePath),
        relativePath
      );
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  console.log("dist/system.json and dist/system.zip match the current PR tree.");
}

await main();
