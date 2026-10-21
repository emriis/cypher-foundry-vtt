/** PR8: protect its 175 reviewed Ability translations and previously approved PR7 content. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readCompendiumCatalogue, readFrenchProposals, reviewCatalogue } from "../../scripts/review-translations.mjs";
import { materializeTranslations } from "../../scripts/localization/materialize-translations.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

test("PR8 keeps exactly 175 newly source-backed reviewed Abilities and all earlier reviews", async () => {
  const [pr7, pr8] = await Promise.all([1, 2].map(async n =>
    JSON.parse(await fs.readFile(path.join(ROOT, "data/localization/ability-review-batch-" + n + ".json"), "utf8"))));
  assert.equal(pr7.expected, 175);
  assert.equal(pr8.expected, 175);
  assert.equal(pr8.ids.length, 175);
  assert.equal(new Set(pr8.ids).size, 175);
  // The manifest sorts source *filenames*, not naked logical IDs: for example,
  // healing-shield.json sorts before healing.json even though the bare IDs
  // would sort the other way around (a '.' delimiter is not a hyphen).
  const filenameOrdered = [...pr8.ids].sort((a, b) => {
    const x = a + ".json", y = b + ".json";
    return x < y ? -1 : x > y ? 1 : 0;
  });
  assert.deepEqual(pr8.ids, filenameOrdered, "Batch file order must remain canonical.");
  assert.equal(pr8.ids[0], "ability.drain-life");
  assert.equal(pr8.ids.at(-1), "ability.incredible-velocity");
  const selected = new Set(pr8.ids);
  const reviewed = new Set([...pr7.ids, ...pr8.ids]);
  assert.equal(reviewed.size, 350, "PR7 and PR8 inventories must be disjoint.");
  const [records, proposals] = await Promise.all([
    readCompendiumCatalogue(ROOT), readFrenchProposals(ROOT)
  ]);
  const report = reviewCatalogue(records, proposals);
  assert.deepEqual(report.orphanedProposals, []);
  const abilityRows = report.entries.filter(row => row.logicalId.startsWith("ability."));
  assert.equal(abilityRows.length, 701, "Entire CRD Ability inventory changed.");
  for (const row of abilityRows) {
    if (reviewed.has(row.logicalId)) {
      assert.equal(row.status, "reviewed", "Previously approved source was lost: " + row.logicalId);
    } else {
      assert.ok(["proposed", "reviewed"].includes(row.status),
        "A future Ability translation is invalid: " + row.logicalId);
    }
    assert.equal(row.sourceFields, row.translatedFields, row.logicalId);
    assert.deepEqual(row.errors, [], row.logicalId);
    assert.deepEqual(row.missingFields, [], row.logicalId);
    assert.equal(row.mechanicalParity, true, row.logicalId);
  }
  for (const row of report.entries.filter(row => row.logicalId.startsWith("skill.") ||
    row.logicalId.startsWith("descriptor."))) {
    assert.equal(row.status, "reviewed", "PR6 reviewed content regressed: " + row.logicalId);
  }
  const en = new Map(records.filter(row => row.pack === "abilities-en")
    .map(row => [row.logicalId, row.document]));
  const fr = new Map(records.filter(row => row.pack === "abilities-fr")
    .map(row => [row.logicalId, row.document]));
  for (const id of pr8.ids) {
    assert.ok(en.has(id) && fr.has(id), "Missing bilingual Ability: " + id);
    assert.equal(en.get(id)._id, fr.get(id)._id, "PR2 identifier regression: " + id);
    assert.deepEqual(en.get(id).system.cost, fr.get(id).system.cost, "Ability costs must stay canonical: " + id);
    assert.equal(en.get(id).system.tier, fr.get(id).system.tier, id);
    assert.equal(en.get(id).system.enabler, fr.get(id).system.enabler, id);
    assert.equal(en.get(id).system.repeatable, fr.get(id).system.repeatable, id);
  }
  const materialized = materializeTranslations(records, proposals);
  const files = new Map(records.filter(row => row.pack === "abilities-fr")
    .map(row => [row.logicalId, row.file]));
  for (const id of pr8.ids) {
    const doc = materialized.get(files.get(id));
    assert.ok(doc, "Missing materialized Ability: " + id);
    assert.equal(doc.flags.cypherFoundry.translation.status, "reviewed");
    assert.equal(doc.flags.cypherFoundry.translation.sourceLanguage, "fr");
  }
  for (const id of ["ability.earthshake-0ddc3d51346e", "ability.earthshake-286f22a79ff8",
    "ability.healing-hand-93d8262ac299", "ability.healing-hand-f1ed07f19df0",
    "ability.improved-machine-companion-10e83ae60f0f", "ability.improved-machine-companion-9c25a7197c58"]) {
    assert.ok(selected.has(id), "Same-name/different-rule variant lost: " + id);
  }
});
