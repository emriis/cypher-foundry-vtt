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
        ? damage
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

test("W4 weapon extraction preserves explicitly named CRD ranges", () => {
  const failures = [];

  function expectedNamedRange(description) {
    const primary = description.replace(
      /extreme range extends to (?:immediate|short|long|very long) range/gi,
      ""
    );
    const match = primary.match(/\b(very long|long|short|immediate) range\b/i);
    if (!match) return null;

    return {
      immediate: "immediate",
      short: "short",
      long: "long",
      "very long": "veryLong"
    }[match[1].toLowerCase()];
  }

  for (const language of ["en", "fr"]) {
    for (const record of readRecords(language)) {
      if (record.crdType !== "weapon") continue;

      const description = normalizeText(record.system.description);
      const expectedRange = expectedNamedRange(description);
      if (expectedRange && record.system.range !== expectedRange) {
        failures.push(
          language + "/" + record.name + ": explicit CRD range is " +
          expectedRange + ", extracted as " + record.system.range
        );
      }

      const extremeMatch = description.match(
        /extreme range extends to (immediate|short|long|very long) range/i
      );
      if (extremeMatch) {
        const expectedExtreme = {
          immediate: "immediate",
          short: "short",
          long: "long",
          "very long": "veryLong"
        }[extremeMatch[1].toLowerCase()];

        if (record.system.extremeRange !== expectedExtreme) {
          failures.push(
            language + "/" + record.name +
            ": explicit CRD extreme range is " + expectedExtreme +
            ", extracted as " + record.system.extremeRange
          );
        }
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("W4 armor extraction preserves explicit CRD armor categories", () => {
  const failures = [];

  for (const language of ["en", "fr"]) {
    for (const record of readRecords(language)) {
      if (record.crdType !== "armor") continue;

      const description = normalizeText(record.system.description);
      const match = description.match(/\b(light|medium|heavy) armor\b/i);
      if (!match) continue;

      const expected = match[1].toLowerCase();
      if (record.system.category !== expected) {
        failures.push(
          language + "/" + record.name + ": CRD armor category is " +
          expected + ", extracted as " + record.system.category
        );
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("W4 armor extraction structures the explicit no-dodge exception", () => {
  const failures = [];

  for (const language of ["en", "fr"]) {
    const spray = readRecords(language).find(
      record => record.name === "Spray-on impact armor"
    );

    if (!spray) {
      failures.push(language + "/Spray-on impact armor: record is missing");
      continue;
    }

    if (spray.system.dodgeHindrance !== 0) {
      failures.push(
        language + "/Spray-on impact armor: CRD says no dodge hindrance, " +
        "extracted as " + spray.system.dodgeHindrance
      );
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});
