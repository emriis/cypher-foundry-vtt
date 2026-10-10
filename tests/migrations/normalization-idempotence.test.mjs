// Characterize writes in owned temporary storage; never normalize the working tree.
import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createValidationWorkspace, removeValidationWorkspace } from "../../scripts/validation-workspace.mjs";

async function sourceSnapshot(root) {
  const snapshot = {};
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (file.endsWith(".json") && file.includes(`${path.sep}_source${path.sep}`)) {
        snapshot[path.relative(root, file)] = createHash("sha256").update(await readFile(file)).digest("hex");
      }
    }
  }
  await walk(path.join(root, "packs"));
  return snapshot;
}

/** Compare every source byte while reporting only changed paths on failure. */
function assertUnchanged(actual, expected) {
  const files = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  const changed = [...files].filter(file => actual[file] !== expected[file]).sort();
  assert.deepEqual(changed, [], "Normalization must preserve every normalized source file");
}

test("Given normalized bilingual sources, when normalization runs again, then names, identities, references and serialized mechanics remain unchanged", async () => {
  const { workspace, root } = await createValidationWorkspace(path.resolve(import.meta.dirname, "../.."));
  try {
    const normalize = (preload = null) => promisify(execFile)(process.execPath, [
      ...(preload ? ["--import", pathToFileURL(preload).href] : []),
      "scripts/migrate-ability-sources.mjs"
    ], { cwd: root });
    await normalize();
    const first = await sourceSnapshot(root);
    assert.ok(Object.keys(first).length > 0);
    await normalize();
    assertUnchanged(await sourceSnapshot(root), first);

    // readdir ordering is an OS detail, not a content contract. Exercise another
    // valid enumeration order without changing any document or source value.
    const preload = path.join(workspace, "reverse-directory-order.mjs");
    await writeFile(preload, `import fs from "node:fs/promises";
const readdir = fs.readdir;
fs.readdir = async (...args) => (await readdir(...args)).reverse();
`);
    await normalize(preload);
    assertUnchanged(await sourceSnapshot(root), first);
  } finally {
    await removeValidationWorkspace(workspace);
  }
});
