/** Translating an Item may not change identity, mechanics, or CRD provenance. */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createValidationWorkspace, removeValidationWorkspace } from "../../scripts/validation-workspace.mjs";
import { readCompendiumCatalogue } from "../../scripts/review-translations.mjs";
import { deriveFrenchCatalogue } from "../../scripts/localization/derive-french-catalogue.mjs";

test("French documents and names remain projections of canonical English identities", async () => {
  const { workspace, root } = await createValidationWorkspace(path.resolve(import.meta.dirname, "../.."));
  try {
    await promisify(execFile)(process.execPath, ["scripts/migrate-ability-sources.mjs"], { cwd: root });
    const english = await readCompendiumCatalogue(root, { languages: ["en"] });
    const french = deriveFrenchCatalogue(english);
    assert.equal(english.length, french.length);
    for (const [index, source] of english.entries()) {
      const translated = french[index].document;
      const original = source.document;
      assert.equal(translated._id, original._id);
      assert.equal(translated._key, original._key);
      assert.equal(translated.flags.cypherFoundry.crd.sourceLogicalId,
        original.flags.cypherFoundry.crd.logicalId);
      assert.equal(translated.flags.cypherFoundry.crd.sourceLocator,
        original.flags.cypherFoundry.crd.sourceLocator);
      assert.equal(translated.flags.cypherFoundry.crd.section,
        original.flags.cypherFoundry.crd.section);
      assert.equal(french[index].pack, source.pack.replace(/-en$/, "-fr"));
    }
    const target = french.find(row => row.document.crdType === "equipment");
    const original = english.find(row => row.logicalId === target.logicalId).document;
    target.document.name = "Proposition française";
    target.document.system.description = "Description française complète proposée.";
    assert.notEqual(target.document.name, original.name);
    assert.equal(target.document._id, original._id);
    assert.equal(target.document.flags.cypherFoundry.crd.logicalId,
      original.flags.cypherFoundry.crd.logicalId);
    assert.deepEqual({ ...target.document.system, description: original.system.description },
      original.system, "Display-only edits cannot change structured rules");
  } finally {
    await removeValidationWorkspace(workspace);
  }
});
