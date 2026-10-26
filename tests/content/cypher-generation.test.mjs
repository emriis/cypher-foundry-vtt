import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { deriveFrenchCatalogue } from "../../scripts/localization/derive-french-catalogue.mjs";
import { CYPHER_GENERATION } from "../../module/rules/cypher-generation-catalogue.mjs";
const root = resolve(import.meta.dirname, "../..");
const read = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const sources = language => {
  const base = "packs/equipment-en/_source";
  const english = readdirSync(resolve(root, base), { recursive: true }).filter(file => file.endsWith(".json"))
    .map(file => read(`${base}/${file}`)).filter(item => item.type === "cypher");
  if (language === "en") return english;
  return deriveFrenchCatalogue(english.map(document => ({ pack: "equipment-en", file: "packs/equipment-en/_source/cyphers", logicalId: document.flags.cypherFoundry.crd.logicalId, document }))).map(record => record.document);
};

test("the executable generation catalogue exactly mirrors the CRD-reviewed authoring table", () => {
  assert.deepEqual(CYPHER_GENERATION, read("data/crd-cypher-generation.json"));
  for (const entries of [...Object.values(CYPHER_GENERATION.tables), CYPHER_GENERATION.manifestPower]) {
    for (let roll = 1; roll <= 100; roll++) assert.equal(entries.filter(entry => roll >= entry.min && roll <= entry.max).length, 1, `d100 ${roll}`);
  }
  const manifest = ["low", "medium", "advanced", "high", "ultra"].flatMap(power => CYPHER_GENERATION.tables[power]);
  assert.equal(manifest.length, 106); assert.equal(new Set(manifest.map(entry => entry.logicalId)).size, 103);
});

test("every random result resolves a real bilingual source and Teleporter's matching power variant", () => {
  for (const language of ["en", "fr"]) {
    const catalogue = new Map(sources(language).map(item => [item.flags.cypherFoundry.crd.sourceLogicalId ?? item.flags.cypherFoundry.crd.logicalId, item]));
    for (const [table, entries] of Object.entries(CYPHER_GENERATION.tables)) for (const entry of entries) {
      if (entry.redirect) { assert.equal(table, "superhero"); assert.equal(entry.redirect, "subtle"); continue; }
      const item = catalogue.get(entry.logicalId); assert.ok(item, `${language}: ${entry.logicalId}`);
      assert.ok(entry.paragraph > 0);
      if (entry.variantName) assert.equal(item.system.variants.filter(variant => variant.powerLevel === table).length, 1);
    }
  }
});
