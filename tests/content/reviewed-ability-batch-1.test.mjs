/** PR7: protect the exact independently reviewed first quarter of CRD Abilities. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readCompendiumCatalogue, readFrenchProposals, reviewCatalogue } from "../../scripts/review-translations.mjs";
import { materializeTranslations } from "../../scripts/localization/materialize-translations.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

test("PR7 keeps precisely 175 approved Abilities and 526 unreviewed future Abilities", async () => {
  const manifest = JSON.parse(await fs.readFile(
    path.join(ROOT, "data/localization/ability-review-batch-1.json"), "utf8"));
  assert.equal(manifest.expected, 175);
  assert.equal(manifest.ids.length, manifest.expected);
  assert.equal(new Set(manifest.ids).size, 175);
  assert.deepEqual(manifest.ids, [...manifest.ids].sort(), "Batch ordering must remain canonical.");
  assert.equal(manifest.ids[0], "ability.a-bit-of-magic");
  assert.equal(manifest.ids.at(-1), "ability.divine-radiance");
  const records = await readCompendiumCatalogue(ROOT);
  const proposals = await readFrenchProposals(ROOT);
  const report = reviewCatalogue(records, proposals);
  const abilityRows = report.entries.filter(row => row.logicalId.startsWith("ability."));
  assert.equal(abilityRows.length, 701, "Entire 2026 CRD ability inventory changed.");
  const selected = new Set(manifest.ids);
  for (const row of abilityRows) {
    const expected = selected.has(row.logicalId) ? "reviewed" : "proposed";
    assert.equal(row.status, expected,
      row.logicalId + " expected " + expected + ", got " + row.status + "; " + row.errors.join("; "));
    assert.equal(row.sourceFields, row.translatedFields, row.logicalId);
    assert.deepEqual(row.errors, [], row.logicalId);
    assert.deepEqual(row.missingFields, [], row.logicalId);
    assert.equal(row.mechanicalParity, true, row.logicalId);
  }
  for (const row of report.entries.filter(row => row.logicalId.startsWith("skill.") ||
    row.logicalId.startsWith("descriptor."))) {
    assert.equal(row.status, "reviewed", "PR7 must preserve PR6 reviews: " + row.logicalId);
  }
  const en = new Map(records.filter(row => row.pack === "abilities-en")
    .map(row => [row.logicalId, row.document]));
  const fr = new Map(records.filter(row => row.pack === "abilities-fr")
    .map(row => [row.logicalId, row.document]));
  for (const id of manifest.ids) {
    assert.ok(en.has(id) && fr.has(id), "Missing language-paired Ability: " + id);
    assert.equal(en.get(id)._id, fr.get(id)._id, "PR2 identifier regression: " + id);
    assert.deepEqual(en.get(id).system.cost, fr.get(id).system.cost, "Changed mechanical cost: " + id);
    assert.equal(en.get(id).system.tier, fr.get(id).system.tier, "Changed Tier: " + id);
    assert.equal(en.get(id).system.enabler, fr.get(id).system.enabler, "Changed activation class: " + id);
  }
  const output = materializeTranslations(records, proposals);
  const sourceFile = new Map(records.filter(row => row.pack === "abilities-fr")
    .map(row => [row.logicalId, row.file]));
  const selectedOutputs = manifest.ids.map(id => output.get(sourceFile.get(id)));
  for (const [index, doc] of selectedOutputs.entries()) {
    assert.ok(doc, "Missing compiled FR Ability: " + manifest.ids[index]);
    assert.equal(doc.flags.cypherFoundry.translation.status, "reviewed");
    assert.equal(doc.flags.cypherFoundry.translation.sourceLanguage, "fr");
  }
  for (const id of ["ability.arc-spray-9eee61f011da", "ability.arc-spray-ffaf47001ba0",
    "ability.agile-wit-54572c3ca6a8", "ability.agile-wit-6b66f1930b13"]) {
    assert.ok(selected.has(id), "Same-name Ability variant lost: " + id);
  }
  const arc = selectedOutputs.filter(doc => doc.name === "Rafale en arc");
  assert.equal(arc.length, 2, "Two distinct mechanically variant Arc Spray definitions remain.");
  assert.notEqual(arc[0].flags.cypherFoundry.crd.logicalId,
    arc[1].flags.cypherFoundry.crd.logicalId);
});
