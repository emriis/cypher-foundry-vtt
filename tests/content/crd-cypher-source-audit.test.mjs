import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve("packs");

function readCyphers(language) {
  const directory = path.join(
    ROOT, "equipment-" + language, "_source", "cyphers", "subtle"
  );
  return fs.readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")));
}

const EXPECTED_SUBTLE = [
  "Amazing effort",
  "Berserk",
  "Best tool",
  "Bleed",
  "Burst of speed",
  "Calm sniper",
  "Collateral damage",
  "Combat enhancer",
  "Counterattack",
  "Crying jag",
  "Deflect wound",
  "Disarm",
  "Disease recovery",
  "Double attack",
  "Equipment cache",
  "Extended breath",
  "Feat of strength",
  "Focus fire",
  "Fortuitous moment",
  "Fortunate fluke",
  "Get to the point",
  "Hamper foe",
  "Horizon observer",
  "Ignite",
  "Improved acrobatics",
  "Improved blocking",
  "Improved charm",
  "Improved climbing",
  "Improved deception",
  "Improved dexterity",
  "Improved disguising",
  "Improved dodging",
  "Improved driving",
  "Improved escaping",
  "Improved healing",
  "Improved initiative",
  "Improved intimidation",
  "Improved jumping",
  "Improved lockpicking",
  "Improved perception",
  "Improved pickpocketing",
  "Improved repairing",
  "Improved sneaking",
  "Improved swimming",
  "Improvised range",
  "Improvised shelter",
  "Improvised shield",
  "Inhibit foe",
  "Inspire aggression",
  "Intellect replenisher",
  "Knockout",
  "Lucid moment",
  "Maintain temperature",
  "Make passage",
  "Master password",
  "Mental concentration",
  "Might replenisher",
  "Motivated aid",
  "Near-death experience",
  "Noncombat enhancer",
  "Not me",
  "Offensive object break",
  "Pacify beast",
  "Perfect moment",
  "Pidgin",
  "Poison recovery",
  "Press the advantage",
  "Push",
  "Quick disable",
  "Quick feint",
  "Quick funds",
  "Remembering",
  "Repel",
  "Restrain",
  "Reveal unseen",
  "Sated",
  "Secret",
  "Silent message",
  "Slippery",
  "Snap alert",
  "Speed replenisher",
  "Take one for the team",
  "Teach trick",
  "Traumatic amnesia",
  "Wound recovery",
  "Wounded desperation",
];

test("CRD subtle cyphers cover the complete 2026-07-29 inventory", () => {
  for (const language of ["en", "fr"]) {
    const records = readCyphers(language);
    assert.equal(records.length, EXPECTED_SUBTLE.length, language);
    assert.deepEqual(
      records.map(record => record.name.toLowerCase()).sort(),
      EXPECTED_SUBTLE.map(name => name.toLowerCase()).sort(),
      language
    );
  }
});

test("CRD subtle cyphers preserve canonical identity and mechanics", () => {
  const en = readCyphers("en");
  const fr = readCyphers("fr");
  const frIds = new Set();

  for (const record of en) {
    assert.equal(record.document, "Item");
    assert.equal(record.type, "cypher");
    assert.equal(record.crdType, "cypher");

    const crd = record.flags.cypherFoundry.crd;
    assert.equal(crd.version, "2026-07-29");
    assert.equal(crd.language, "en");
    assert.match(crd.logicalId, /^cypher\.[a-z0-9-]+$/);
    assert.match(crd.sourceLocator, /^CRD — Example Cyphers — /);

    assert.equal(record.system.cypherType, "subtle");
    assert.equal(record.system.level, 4);
    assert.equal(record.system.powerLevel, "");
    assert.equal(record.system.internal, false);
    assert.equal(record.system.identified, true);
    assert.equal(record.system.depleted, false);
    assert.ok(record.system.description);

    const french = fr.find(candidate =>
      candidate.flags.cypherFoundry.crd.sourceLogicalId === crd.logicalId
    );
    assert.ok(french, record.name);
    frIds.add(french.flags.cypherFoundry.crd.logicalId);
    assert.equal(french.name, record.name);
    assert.equal(french.type, "cypher");
    assert.deepEqual(
      {...french.system, description: undefined},
      {...record.system, description: undefined}
    );
  }

  assert.equal(frIds.size, en.length);
});
