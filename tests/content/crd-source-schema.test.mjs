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
