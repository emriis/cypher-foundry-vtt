import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readPackSourceMap, readPackSources } from "../helpers/canonical-sources.mjs";

import { CRD_EQUIPMENT_INVENTORY } from "../fixtures/crd-equipment-inventory.mjs";
import { proposedLogicalId, proposedFoundryId } from "../../scripts/source-migration/id-contract.mjs";

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
    if (record.document === "Item" && ["equipment", "weapon", "armor", "shield"].includes(record.crdType)) records.push(record);
  }
  return records;
}

function equipmentRecords(language) {
  return readPackSources(path.resolve("."), `equipment-${language}`)
    .filter(record => record.document === "Item" && ["equipment", "weapon", "armor", "shield"].includes(record.crdType));
}

function expectedLogicalIds() {
  return new Set(
    CRD_EQUIPMENT_INVENTORY.map(([genre, priceCategory, sourceName]) =>
      proposedLogicalId(`equipment.${genre}.${priceCategory}.${sourceName}`)
    )
  );
}

for (const language of ["en", "fr"]) {
  test(`CRD equipment ${language} logical identity matches the canonical inventory tuple`, () => {
    const expected = expectedLogicalIds();
    const records = equipmentRecords(language);
    const failures = [];

    for (const record of records) {
      const provenance = record.flags?.cypherFoundry?.crd;
      const actual = provenance?.logicalId;
      if (!expected.has(actual) || record._id !== proposedFoundryId(actual)) {
        failures.push(`${record.name}: unexpected logicalId=${actual}`);
      }

      if (
        language === "fr" &&
        provenance?.sourceLogicalId !== actual
      ) {
        failures.push(
          `${record.name}: sourceLogicalId does not match logicalId`
        );
      }
    }

    assert.deepEqual(failures, [], failures.join("\n"));
    assert.equal(
      new Set(records.map(record => record.flags.cypherFoundry.crd.logicalId)).size,
      records.length
    );
  });
}
