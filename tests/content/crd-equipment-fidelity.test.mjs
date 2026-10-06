import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve("packs");

function readRecords(language) {
  const root = path.join(ROOT, `equipment-${language}`, "_source");
  const records = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".json")) continue;

      const record = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (record.document === "Item") {
        records.push(record);
      }
    }
  }

  visit(root);
  return records;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stable(nested)])
  );
}

function mechanicalProjection(record) {
  const system = { ...record.system };
  delete system.description;
  delete system.properties;

  return stable({
    crdType: record.crdType,
    type: record.type,
    system
  });
}

function byLogicalId(records) {
  return new Map(
    records.map(record => [
      record.flags.cypherFoundry.crd.logicalId,
      record
    ])
  );
}

test("CRD equipment extraction does not invent generic equipment weight", () => {
  const failures = [];

  for (const language of ["en", "fr"]) {
    for (const record of readRecords(language)) {
      if (record.type !== "equipment") continue;

      if (Object.prototype.hasOwnProperty.call(record.system, "weight")) {
        failures.push(
          `${language}/${record.name}: generic equipment must not define weight`
        );
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("all extracted equipment records preserve their CRD document type", () => {
  const expectedType = {
    equipment: "equipment",
    weapon: "attack",
    armor: "armor",
    shield: "shield"
  };
  const failures = [];

  for (const language of ["en", "fr"]) {
    for (const record of readRecords(language)) {
      const expected = expectedType[record.crdType];
      if (expected && record.type !== expected) {
        failures.push(
          `${language}/${record.name}: crdType=${record.crdType} type=${record.type}`
        );
      }

      if (record.crdType === "weapon" &&
          !["light", "medium", "heavy"].includes(record.system.attackType)) {
        failures.push(
          `${language}/${record.name}: invalid weapon attackType`
        );
      }

      if (record.crdType === "armor" &&
          !["light", "medium", "heavy"].includes(record.system.category)) {
        failures.push(
          `${language}/${record.name}: invalid armor category`
        );
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("English and French equipment preserve identical mechanical data", () => {
  const english = byLogicalId(readRecords("en"));
  const french = byLogicalId(readRecords("fr"));
  const failures = [];

  assert.equal(french.size, english.size);

  for (const [logicalId, en] of english) {
    const fr = french.get(logicalId);
    if (!fr) {
      failures.push(`Missing French record: ${logicalId}`);
      continue;
    }

    const left = JSON.stringify(mechanicalProjection(en));
    const right = JSON.stringify(mechanicalProjection(fr));

    if (left !== right) {
      failures.push(`Mechanical mismatch: ${logicalId}`);
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("high-risk CRD equipment mechanics remain structured in source packs", () => {
  const english = readRecords("en");
  const byName = new Map(english.map(record => [record.name, record]));

  const stunstick = byName.get("Stunstick");
  assert.equal(stunstick.system.attackType, "medium");
  assert.equal(stunstick.system.damage, 0);
  assert.deepEqual(stunstick.system.mechanics.targetEffects, [
    {
      minimumTargetLevel: 0,
      maximumTargetLevel: 2,
      effect: "loseNextAction",
      hinderSteps: 0,
      duration: "next action"
    },
    {
      minimumTargetLevel: 3,
      maximumTargetLevel: null,
      effect: "hindered",
      hinderSteps: 2,
      duration: "a round or two"
    }
  ]);

  const blade = byName.get("Monomolecular blade");
  assert.equal(blade.system.attackType, "light");
  assert.equal(blade.system.mechanics.ignoresPhysicalArmor, 1);
  assert.equal(blade.system.mechanics.cutsThroughMaterialsLevel, 6);

  const rifle = byName.get("Vacuum assault rifle");
  assert.equal(rifle.system.attackType, "heavy");
  assert.equal(rifle.system.mechanics.rapidFire, true);
  assert.deepEqual(rifle.system.mechanics.alternateConfiguration, {
    enabled: true,
    attackType: "medium",
    action: "action"
  });

  const cannon = byName.get("Blast cannon");
  assert.equal(cannon.system.attackType, "heavy");
  assert.equal(cannon.system.damage, 10);
  assert.equal(cannon.system.range, "veryLong");
  assert.equal(cannon.system.mechanics.requiresTripod, true);
  assert.equal(cannon.system.mechanics.requiredOperators, 2);
  assert.equal(cannon.system.mechanics.rapidFire, true);

  const sprayArmor = byName.get("Spray-on impact armor");
  assert.equal(sprayArmor.system.category, "light");
  assert.match(sprayArmor.system.description, /depletion 1 in 1d10/i);
});
