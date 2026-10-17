// Translation is editorial: normalization must keep canonical English identities
// and CRD locators even when the translated names and source filenames differ.
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { createValidationWorkspace, removeValidationWorkspace } from "../../scripts/validation-workspace.mjs";

async function readDocuments(root, pack) {
  const directory = path.join(root, "packs", pack, "_source");
  const documents = [];
  for (const file of await readdir(directory, { recursive: true })) {
    if (!file.endsWith(".json")) continue;
    const filename = path.join(directory, file);
    const document = JSON.parse(await readFile(filename, "utf8"));
    if (!document._key?.startsWith("!folders!")) documents.push({ filename, document });
  }
  return documents;
}

async function normalize(root) {
  await promisify(execFile)(process.execPath, ["scripts/migrate-ability-sources.mjs"], { cwd: root });
}

test("Given a translated equipment name, when sources normalize again, then its canonical identity, path and mechanics remain unchanged", async () => {
  const { workspace, root } = await createValidationWorkspace(path.resolve(import.meta.dirname, "../.."));
  try {
    await normalize(root);
    const french = (await readDocuments(root, "equipment-fr"))
      .find(entry => entry.document.crdType === "equipment");
    const before = structuredClone(french.document);
    const english = (await readDocuments(root, "equipment-en"))
      .find(entry => entry.document.flags.cypherFoundry.crd.logicalId === before.flags.cypherFoundry.crd.logicalId);
    assert.ok(english, "The inventory fixture must have an explicit English source counterpart");
    french.document.name = "Nom français proposé";
    french.document.system.description = "Description française complète proposée.";
    await writeFile(french.filename, JSON.stringify(french.document, null, 2) + "\n");

    await normalize(root);
    const after = JSON.parse(await readFile(french.filename, "utf8"));
    assert.equal(after.name, french.document.name);
    assert.equal(after.system.description, french.document.system.description);
    assert.equal(after._id, before._id, "A translation must never rename a Foundry document");
    assert.equal(after._key, before._key);
    assert.equal(after.flags.cypherFoundry.crd.logicalId, before.flags.cypherFoundry.crd.logicalId);
    assert.equal(after.flags.cypherFoundry.crd.sourceLogicalId, before.flags.cypherFoundry.crd.logicalId);
    assert.equal(after.flags.cypherFoundry.crd.section, english.document.flags.cypherFoundry.crd.section);
    assert.equal(after.flags.cypherFoundry.crd.sourceLocator, english.document.flags.cypherFoundry.crd.sourceLocator);
    assert.deepEqual({ ...after.system, description: before.system.description }, before.system,
      "Changing translated text must preserve every structured mechanical value");
  } finally {
    await removeValidationWorkspace(workspace);
  }
});

test("Given translated Type and Focus names, when sources normalize, then their provenance cites the English CRD headings", async () => {
  const { workspace, root } = await createValidationWorkspace(path.resolve(import.meta.dirname, "../.."));
  try {
    await normalize(root);
    for (const family of ["types", "foci"]) {
      const english = (await readDocuments(root, `${family}-en`))[0];
      const filename = path.join(root, "packs", `${family}-fr`, "_source", path.basename(english.filename));
      const french = JSON.parse(await readFile(filename, "utf8"));
      const id = french._id;
      french.name = `Proposition française (${family})`;
      await writeFile(filename, JSON.stringify(french, null, 2) + "\n");
      await normalize(root);
      const after = JSON.parse(await readFile(filename, "utf8"));
      assert.equal(after.name, french.name);
      assert.equal(after._id, id);
      assert.equal(after.flags.cypherFoundry.crd.section, english.document.flags.cypherFoundry.crd.section);
      assert.equal(after.flags.cypherFoundry.crd.sourceLocator, english.document.flags.cypherFoundry.crd.sourceLocator);
    }
  } finally {
    await removeValidationWorkspace(workspace);
  }
});
