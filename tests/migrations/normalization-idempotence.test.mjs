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

/** Localization retains the actual English CRD heading, including repaired parent references. */
async function assertCanonicalAbilityProvenance(root) {
  const english = new Map();
  for (const language of ["en", "fr"]) {
    const directory = path.join(root, "packs", `abilities-${language}`, "_source");
    for (const filename of await readdir(directory)) {
      if (!filename.endsWith(".json")) continue;
      const document = JSON.parse(await readFile(path.join(directory, filename), "utf8"));
      if (document._key?.startsWith("!folders!")) continue;
      const provenance = document.flags.cypherFoundry.crd;
      if (language === "en") english.set(provenance.logicalId, provenance);
      else {
        const source = english.get(provenance.sourceLogicalId);
        assert.ok(source, `${filename} must have an explicit canonical English source`);
        assert.equal(provenance.language, "fr");
        assert.equal(provenance.section, source.section, `${filename} must cite the English CRD section on the first pass`);
        assert.equal(provenance.sourceLocator, source.sourceLocator, `${filename} must cite the English CRD heading on the first pass`);
      }
    }
  }
}

test("Given normalized bilingual sources, when normalization runs again, then names, identities, references and serialized mechanics remain unchanged", async () => {
  const { workspace, root } = await createValidationWorkspace(path.resolve(import.meta.dirname, "../.."));
  try {
    const normalize = (preload = null) => promisify(execFile)(process.execPath, [
      ...(preload ? ["--import", pathToFileURL(preload).href] : []),
      "scripts/migrate-ability-sources.mjs"
    ], { cwd: root });
    await normalize();
    await assertCanonicalAbilityProvenance(root);
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
