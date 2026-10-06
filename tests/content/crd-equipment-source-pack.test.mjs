// Source-pack validation runs with the complete content suite.\nimport assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateCrdSourceRecord } from "../../module/crd/source-schema.mjs";

const ROOT = path.resolve("packs");

function readJsonRecords(directory) {
  const records = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      records.push(...readJsonRecords(fullPath));
      continue;
    }

    if (!entry.name.endsWith(".json")) continue;
    const record = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (record.document === "Item") records.push(record);
  }

  return records;
}

function equipmentRecords(language) {
  return readJsonRecords(path.join(ROOT, `equipment-${language}`, "_source"));
}

for (const language of ["en", "fr"]) {
  test(`CRD equipment ${language} source pack contains 259 valid records`, () => {
    const records = equipmentRecords(language);

    assert.equal(records.length, 259);

    const failures = [];
    for (const record of records) {
      const validationErrors = validateCrdSourceRecord(record);
      if (validationErrors.length) {
        failures.push(`${language}/${record.name}: ${validationErrors.join("; ")}`);
      }
      if (record.flags.cypherFoundry.crd.language !== language) {
        failures.push(`${language}/${record.name}: language=${record.flags.cypherFoundry.crd.language}`);
      }
    }
    assert.deepEqual(failures, [], failures.join("\n"));

    const logicalIds = records.map(
      record => record.flags.cypherFoundry.crd.logicalId
    );
    assert.equal(new Set(logicalIds).size, records.length);
  });
}

test("French CRD equipment records pair with English source logical ids", () => {
  const english = new Set(
    equipmentRecords("en").map(
      record => record.flags.cypherFoundry.crd.logicalId
    )
  );

  for (const record of equipmentRecords("fr")) {
    const provenance = record.flags.cypherFoundry.crd;
    assert.equal(provenance.sourceLogicalId, provenance.logicalId);
    assert.ok(english.has(provenance.sourceLogicalId), record.name);
  }
});
