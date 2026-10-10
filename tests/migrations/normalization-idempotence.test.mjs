// Characterize writes in owned temporary storage; never normalize the working tree.
import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
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

test("Given normalized bilingual sources, when normalization runs again, then names, identities, references and serialized mechanics remain unchanged", async () => {
  const { workspace, root } = await createValidationWorkspace(path.resolve(import.meta.dirname, "../.."));
  try {
    const normalize = () => promisify(execFile)(process.execPath, ["scripts/migrate-ability-sources.mjs"], { cwd: root });
    await normalize();
    const first = await sourceSnapshot(root);
    assert.ok(Object.keys(first).length > 0);
    await normalize();
    assert.deepEqual(await sourceSnapshot(root), first);
  } finally {
    await removeValidationWorkspace(workspace);
  }
});
