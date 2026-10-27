import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
import { SPECIES_BENEFITS } from "../../module/rules/species-benefit-catalogue.mjs";
import { deriveFrenchCatalogue } from "../../scripts/localization/derive-french-catalogue.mjs";
const root = resolve(import.meta.dirname, "../..");
const read = file => JSON.parse(readFileSync(resolve(root, file), "utf8"));

test("the reviewed species contracts mirror browser rules and resolve the same source slots in both languages", () => {
  assert.deepEqual(SPECIES_BENEFITS, read("data/crd-species-benefits.json"));
  assert.equal(SPECIES_BENEFITS.rules.length, 34);
  assert.equal(new Set(SPECIES_BENEFITS.rules.map(rule => rule.id)).size, 34);
  for (const rule of SPECIES_BENEFITS.rules) {
    const slug = rule.sourceId.slice("descriptor.species.".length), file = `packs/descriptors-en/_source/species/${slug}.json`;
    const english = read(file);
    const canonical = english.flags?.cypherFoundry?.crd?.logicalId;
    if (canonical) assert.equal(canonical, rule.sourceId); else assert.equal(english._id, rule.legacySourceItemId);
    assert.ok(rule.paragraph > 0);
    english.flags.cypherFoundry = { crd: { logicalId: rule.sourceId } };
    const french = deriveFrenchCatalogue([{ pack: "descriptors-en", file, logicalId: rule.sourceId, document: english }])[0].document;
    assert.equal(french.flags.cypherFoundry.crd.sourceLogicalId, rule.sourceId);
    const passages = rule.benefitIndex !== null ? [english.system.benefits[rule.benefitIndex].description.split("</p>")[0]] : [...english.system.description.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match => match[1]);
    assert.ok(passages.some(text => createHash("sha256").update(plainText(text).replace(/\s+/g, " ").trim()).digest("hex") === rule.sourceTextHash), rule.id);
    if (rule.benefitIndex !== null) {
      assert.ok(english.system.benefits[rule.benefitIndex].description);
      assert.deepEqual(french.system.benefits[rule.benefitIndex], english.system.benefits[rule.benefitIndex]);
    } else assert.equal(rule.kind, "training");
  }
});
