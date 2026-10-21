import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { selectPR9Abilities } from "../../scripts/audit-ability-batch-3.mjs";
import { readCompendiumCatalogue, readFrenchProposals, reviewCatalogue } from "../../scripts/review-translations.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

test("PR9 third Ability tranche is deterministic, complete and disjoint from PR7/PR8", async () => {
  const previous = (await Promise.all([1, 2].map(n =>
    fs.readFile(path.join(ROOT, "data/localization/ability-review-batch-" + n + ".json"), "utf8")
      .then(JSON.parse)))).flatMap(manifest => manifest.ids);
  const proposals = await readFrenchProposals(ROOT);
  const ids = await selectPR9Abilities(ROOT, proposals);
  assert.equal(previous.length, 350);
  assert.equal(new Set([...previous, ...ids]).size, 525);
  assert.equal(ids.length, 175);
  const all = [...proposals.keys()].filter(id => id.startsWith("ability."))
    .sort((a, b) => a + ".json" < b + ".json" ? -1 : a + ".json" > b + ".json" ? 1 : 0);
  assert.deepEqual(ids, all.slice(350, 525));
  const records = await readCompendiumCatalogue(ROOT);
  const reviews = new Map(reviewCatalogue(records, proposals).entries.map(row => [row.logicalId, row]));
  for (const id of [...previous, ...ids]) {
    const row = reviews.get(id);
    assert.ok(row, "Missing " + id);
    assert.deepEqual(row.errors, [], id);
    assert.deepEqual(row.missingFields, [], id);
    assert.equal(row.mechanicalParity, true, id);
    assert.equal(row.sourceFields, row.translatedFields, id);
    if (previous.includes(id)) assert.equal(row.status, "reviewed", id);
    else assert.ok(["proposed", "reviewed"].includes(row.status), id);
  }
});

test("PR9 audit cannot approve a draft or alter canonical identity", async () => {
  const content = await fs.readFile(path.join(ROOT, "scripts/audit-ability-batch-3.mjs"), "utf8");
  assert.ok(!/proposal\.status\s*=/.test(content));
  const ids = await selectPR9Abilities(ROOT);
  assert.ok(ids.every(id => /^ability\.[a-z0-9-]+$/.test(id)));
});
