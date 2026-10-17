import assert from "node:assert/strict";
import test from "node:test";

import {
  CRD_SOURCE_VERSION,
  buildCrdFlags,
  getCrdLogicalId,
  getCrdProvenance,
  validateCrdSourceRecord
} from "../../module/crd/source-schema.mjs";

const baseRecord = {
  _id: "0123456789abcdef",
  _key: "!items!0123456789abcdef",
  name: "Example Ability",
  document: "Item",
  type: "ability",
  crdType: "ability",
  flags: buildCrdFlags({
    version: CRD_SOURCE_VERSION,
    logicalId: "ability.example-ability",
    language: "en",
    sourceKind: "passage",
    section: "Genre Character Abilities",
    sourceLocator: "CRD p. 123",
    transformations: []
  })
};

test("validates a CRD source record", () => {
  assert.deepEqual(validateCrdSourceRecord(baseRecord), []);
  assert.equal(getCrdLogicalId(baseRecord), "ability.example-ability");
  assert.equal(getCrdProvenance(baseRecord).version, CRD_SOURCE_VERSION);
});

for (const [field, value, message] of [
  ["_id", "short", /_id/], ["_key", "!actors!0123456789abcdef", /_key/],
  ["document", "Unknown", /document/], ["name", " ", /name/],
  ["crdType", "unknown", /content type/], ["type", null, /item type/],
  ["flags.cypherFoundry.crd.version", "old", /version/],
  ["flags.cypherFoundry.crd.logicalId", " ", /logicalId/],
  ["flags.cypherFoundry.crd.language", "de", /language/],
  ["flags.cypherFoundry.crd.sourceKind", "unknown", /sourceKind/],
  ["flags.cypherFoundry.crd.section", "", /section/],
  ["flags.cypherFoundry.crd.sourceLocator", "", /sourceLocator/],
  ["flags.cypherFoundry.crd.transformations", {}, /transformations/]
]) {
  test(`rejects invalid ${field} without mutating the source`, () => {
    const record = structuredClone(baseRecord), parts = field.split(".");
    let target = record;
    for (const part of parts.slice(0, -1)) target = target[part];
    target[parts.at(-1)] = value;
    const before = structuredClone(record);
    assert.match(validateCrdSourceRecord(record).join(" "), message);
    assert.deepEqual(record, before);
  });
}
test("rejects non-object source roots", () => {
  for (const record of [null, [], "text"]) assert.match(validateCrdSourceRecord(record).join(" "), /object/);
});

test("rejects missing provenance", () => {
  const record = { ...baseRecord };
  delete record.flags;

  assert.ok(
    validateCrdSourceRecord(record).includes(
      "Missing CRD provenance metadata."
    )
  );
});

test("requires an English source for French records", () => {
  const record = {
    ...baseRecord,
    flags: buildCrdFlags({
      ...getCrdProvenance(baseRecord),
      language: "fr"
    })
  };

  assert.ok(
    validateCrdSourceRecord(record).includes(
      "French CRD records must identify their English sourceLogicalId."
    )
  );
});

test("does not rewrite source mechanics", () => {
  const record = {
    ...baseRecord,
    system: {
      description: "Source text is preserved exactly.",
      cost: { amount: 5 }
    }
  };

  assert.deepEqual(validateCrdSourceRecord(record), []);
  assert.equal(record.system.cost.amount, 5);
});


test("requires document-aware Foundry keys", () => {
  const actor = {
    _id: "0123456789abcdef",
    _key: "!actors!0123456789abcdef",
    document: "Actor",
    name: "Example Creature",
    crdType: "creature",
    type: "npc",
    flags: {
      cypherFoundry: {
        crd: {
          version: "2026-07-29",
          logicalId: "creature.example-creature",
          language: "en",
          sourceKind: "record",
          section: "Creatures",
          sourceLocator: "CRD p. 400",
          transformations: []
        }
      }
    }
  };

  assert.deepEqual(validateCrdSourceRecord(actor), []);
});
