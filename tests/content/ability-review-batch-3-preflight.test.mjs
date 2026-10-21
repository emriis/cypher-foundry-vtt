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
    else assert.equal(row.status, "reviewed", "PR9 reviewed entry regressed: " + id);
  }
});

test("PR9 audit cannot approve a draft or alter canonical identity", async () => {
  const content = await fs.readFile(path.join(ROOT, "scripts/audit-ability-batch-3.mjs"), "utf8");
  assert.ok(!/proposal\.status\s*=/.test(content));
  const ids = await selectPR9Abilities(ROOT);
  assert.ok(ids.every(id => /^ability\.[a-z0-9-]+$/.test(id)));
});

test("PR9 locked variants remain separate, and none of its drafts is silently promoted", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, "data/localization/ability-review-batch-3.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.expected, 175);
  assert.equal(manifest.ids.length, 175);
  assert.equal(new Set(manifest.ids).size, 175);
  assert.equal(manifest.ids[0], "ability.infer-thoughts");
  assert.equal(manifest.ids.at(-1), "ability.resonant-palm");
  for (const variants of [
    ["ability.invisibility-1deb88a5b977", "ability.invisibility-724e3c5611b4"],
    ["ability.jump-attack-a7b79b914e52", "ability.jump-attack-b9f203df6db4"],
    ["ability.machine-companion-5cf919f68484", "ability.machine-companion-8746b7c84e90"],
    ["ability.mind-reading-086a4c8ea1f4", "ability.mind-reading-613857bce03f", "ability.mind-reading-9cc67835a3aa"],
    ["ability.no-need-for-weapons-e116a685139a", "ability.no-need-for-weapons-e286df086fb2"],
    ["ability.prepare-spell-2d7a36fdd65a", "ability.prepare-spell-9fb0e71b461c"],
    ["ability.quarry-2b6cfec01a1b", "ability.quarry-ba43f470f733"]
  ]) {
    for (const id of variants) assert.ok(manifest.ids.includes(id), "Missing independent rules variant: " + id);
  }
  const proposals = await readFrenchProposals(ROOT);
  for (const id of manifest.ids) {
    assert.ok(proposals.has(id), "Missing source-backed editorial record: " + id);
    assert.equal(proposals.get(id).proposal.language, "fr", id);
  }
});

test("PR9 yields 525 reviewed Abilities, 111 earlier records and 737 remaining proposals", async () => {
  const records = await readCompendiumCatalogue(ROOT);
  const proposals = await readFrenchProposals(ROOT);
  const review = reviewCatalogue(records, proposals);
  const counts = new Map();
  for (const row of review.entries) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  assert.equal(review.entries.length, 1373);
  assert.equal(review.entries.filter(row => row.logicalId.startsWith("ability.") && row.status === "reviewed").length, 525);
  assert.equal(counts.get("reviewed"), 636);
  assert.equal(counts.get("proposed"), 737);
  assert.deepEqual(review.orphanedProposals, []);
});
