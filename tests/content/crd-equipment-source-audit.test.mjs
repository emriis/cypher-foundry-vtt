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
      if (record.document === "Item") records.push(record);
    }
  }

  visit(root);
  return records;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceNoteLooksContaminated(note) {
  return [
    "Fantasy Currency Equivalences",
    "Science Fiction Equipment",
    "Postapocalypse Equipment",
    "Superhero Equipment",
    "Real-World Currency Equivalences",
    "Sci-fi Currency Equivalences",
    "Exorbitant Items Item Note",
    "Expensive Items Item Note",
    "Very Expensive Items Item Note",
    "Moderately Priced Items Item Note",
    "Inexpensive Items Item Note"
  ].some(marker => note.includes(marker));
}

test("W4 source extraction does not invent generic equipment weight", () => {
  const failures = [];

  for (const language of ["en", "fr"]) {
    for (const record of readRecords(language)) {
      if (record.crdType !== "equipment") continue;

      if (Object.prototype.hasOwnProperty.call(record.system, "weight")) {
        failures.push(
          `${language}/${record.name}: generic equipment contains invented weight`
        );
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("W4 source extraction does not invent generic equipment depletion", () => {
  const failures = [];

  for (const language of ["en", "fr"]) {
    for (const record of readRecords(language)) {
      if (record.crdType !== "equipment") continue;

      const description = normalizeText(record.system.description);
      const hasDepletion = /depletion/i.test(description);

      if (!hasDepletion && (
        record.system.depletionDie !== "none" ||
        record.system.depletionMin !== 1 ||
        record.system.depletionMax !== 1
      )) {
        failures.push(
          `${language}/${record.name}: depletion exists without CRD depletion`
        );
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("W4 source extraction keeps each CRD item note isolated", () => {
  const failures = [];

  for (const language of ["en", "fr"]) {
    for (const record of readRecords(language)) {
      const description = normalizeText(record.system.description);

      if (sourceNoteLooksContaminated(description)) {
        failures.push(
          `${language}/${record.name}: description contains adjacent CRD table content`
        );
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("W4 weapon extraction respects heavy weapon two-hand rules", () => {
  const failures = [];

  for (const language of ["en", "fr"]) {
    for (const record of readRecords(language)) {
      if (record.crdType !== "weapon") continue;

      const { attackType, damage, mechanics } = record.system;
      const expectedDamage = attackType == null
        ? null
        : { light: 2, medium: 4, heavy: 6 }[attackType];

      if (
        record.name !== "Blast cannon" &&
        record.name !== "Stunstick" &&
        damage !== expectedDamage
      ) {
        failures.push(
          `${language}/${record.name}: ${attackType} weapon has damage ${damage}, expected ${expectedDamage}`
        );
      }

      if (
        attackType === null &&
        !/Explosive weapon/i.test((record.system.properties || []).join(" "))
      ) {
        failures.push(
          `${language}/${record.name}: uncategorized weapon is not an explicit special weapon`
        );
      }

      if (
        attackType === "heavy" &&
        record.name !== "Blast cannon" &&
        mechanics?.twoHanded !== true
      ) {
        failures.push(
          `${language}/${record.name}: heavy weapon is not marked two-handed`
        );
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("W4 armor extraction preserves explicit depletion mechanics", () => {
  const byName = new Map(
    readRecords("en")
      .filter(record => record.crdType === "armor")
      .map(record => [record.name, record])
  );
  const spray = byName.get("Spray-on impact armor");

  assert.ok(spray);
  assert.equal(spray.system.depletionDie, "d10");
  assert.equal(spray.system.depletionMin, 1);
  assert.equal(spray.system.depletionMax, 1);
});

test("W4 armor extraction preserves explicit armor exceptions", () => {
  const byName = new Map(
    readRecords("en")
      .filter(record => record.crdType === "armor")
      .map(record => [record.name, record])
  );
  const failures = [];

  const dwarven = byName.get("Dwarven breastplate");
  if (!dwarven || dwarven.system.blockEaseDamage !== 3) {
    failures.push("Dwarven breastplate must ease block tasks by an additional step");
  }

  for (const name of ["Elven chainmail", "Impact cloak*"]) {
    const record = byName.get(name);
    if (!record) continue;

    if (record.system.encumbranceCategory !== "light") {
      failures.push(`${name}: explicit light encumbrance is not structured`);
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("W4 source extraction keeps EN and FR mechanical projections identical", () => {
  function projection(record) {
    const system = { ...record.system };
    delete system.description;
    delete system.properties;
    return JSON.stringify({
      crdType: record.crdType,
      type: record.type,
      system
    });
  }

  const english = new Map(
    readRecords("en").map(record => [
      record.flags.cypherFoundry.crd.logicalId,
      record
    ])
  );
  const french = new Map(
    readRecords("fr").map(record => [
      record.flags.cypherFoundry.crd.logicalId,
      record
    ])
  );
  const failures = [];

  for (const [logicalId, en] of english) {
    const fr = french.get(logicalId);
    if (!fr) {
      failures.push(`Missing French record: ${logicalId}`);
      continue;
    }

    if (projection(en) !== projection(fr)) {
      failures.push(`Mechanical mismatch: ${logicalId}`);
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});
