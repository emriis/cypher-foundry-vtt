import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateCrdSourceRecord } from "../../module/crd/source-schema.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TYPE_DIRS = ["types-en", "types-fr"];

const TYPE_NAMES = [
  "android",
  "archer",
  "knife-fighter",
  "axe-fighter",
  "barbarian",
  "bard",
  "burglar",
  "cleric",
  "crimefighter-rank-1",
  "dealer",
  "diplomat",
  "druid",
  "enhanced-hero-rank-2",
  "engineer",
  "fighter",
  "heavy",
  "living-god-rank-5",
  "mage",
  "medic",
  "monk",
  "necromancer",
  "noble",
  "noble-warrior",
  "operative",
  "paladin",
  "pilot",
  "powerhouse-rank-4",
  "powerstar-rank-2",
  "priest",
  "psion",
  "ranger",
  "rogue",
  "scoundrel",
  "soldier",
  "sorcerer",
  "starpilot",
  "superhuman-rank-3",
  "survivor",
  "swashbuckler",
  "sword-fighter",
  "tech",
  "tender",
  "thief",
  "trader",
  "two-weapon-fighter",
  "vigilante-rank-1",
  "warrior",
  "witch",
  "wizard"
];

function readTypes(language) {
  const directory = path.join(ROOT, "packs", `types-${language}`, "_source");
  return TYPE_NAMES.map(name => {
    const filename = `${name}.json`;
    const file = path.join(directory, filename);
    assert.ok(fs.existsSync(file), `${language}: missing ${filename}`);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  });
}

test("CRD Type source packs cover the complete Type inventory", () => {
  for (const language of TYPE_DIRS.map(value => value.slice(-2))) {
    assert.equal(readTypes(language).length, 49);
  }
});

test("CRD Type records satisfy the source contract", () => {
  const english = readTypes("en");
  const french = readTypes("fr");
  const englishIds = new Set();

  for (const record of english) {
    assert.equal(record.document, "Item", record.name);
    assert.equal(record.crdType, "type", record.name);
    assert.deepEqual(validateCrdSourceRecord(record), [], record.name);

    const provenance = record.flags.cypherFoundry.crd;
    assert.equal(provenance.language, "en", record.name);
    assert.match(provenance.logicalId, /^type\.[a-z0-9-]+$/, record.name);
    assert.ok(!englishIds.has(provenance.logicalId), provenance.logicalId);
    englishIds.add(provenance.logicalId);

    assert.equal(
      record.system.abilityTiers.length,
      record.system.abilities.length,
      `${record.name}: ability tier count`
    );
    assert.ok(
      record.system.abilityTiers.every(entry => entry.tier === 1),
      `${record.name}: fixed Type abilities must be tier 1`
    );
    assert.deepEqual(
      record.system.abilityTiers.map(entry => entry.ability),
      record.system.abilities,
      `${record.name}: ability tier references`
    );
  }

  for (const record of french) {
    assert.equal(record.document, "Item", record.name);
    assert.equal(record.crdType, "type", record.name);
    assert.deepEqual(validateCrdSourceRecord(record), [], record.name);

    const provenance = record.flags.cypherFoundry.crd;
    assert.equal(provenance.language, "fr", record.name);
    assert.equal(
      provenance.sourceLogicalId,
      provenance.logicalId,
      `${record.name}: French Type logical-id pairing`
    );
    assert.ok(
      englishIds.has(provenance.logicalId),
      `${record.name}: missing English Type logical ID`
    );
  }
});
