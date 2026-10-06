import assert from "node:assert/strict";
import test from "node:test";

class FieldDefinition {
  constructor(options = {}) { this.options = options; }
}

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: {
    StringField: FieldDefinition,
    NumberField: FieldDefinition,
    HTMLField: FieldDefinition,
    BooleanField: FieldDefinition
  }}
};

const { default: CypherArtifactData } =
  await import("../../module/data-models/item-artifact.mjs");
const { default: CypherEquipmentData } =
  await import("../../module/data-models/item-equipment.mjs");

test("artifact schema stores an inclusive depletion range", () => {
  const schema = CypherArtifactData.defineSchema();
  assert.ok(schema.depletionMin);
  assert.ok(schema.depletionMax);
  assert.equal(schema.depletionMin.options.initial, 1);
  assert.equal(schema.depletionMax.options.initial, 1);
});

test("equipment schema stores an inclusive depletion range", () => {
  const schema = CypherEquipmentData.defineSchema();
  assert.ok(schema.depletionMin);
  assert.ok(schema.depletionMax);
});

test("legacy single depletion threshold migrates to an equivalent range", () => {
  const artifact = CypherArtifactData.migrateData({
    depletionThreshold: 3
  });
  const equipment = CypherEquipmentData.migrateData({
    depletionThreshold: 2
  });

  assert.deepEqual(artifact, { depletionMin: 3, depletionMax: 3 });
  assert.deepEqual(equipment, { depletionMin: 2, depletionMax: 2 });
});
