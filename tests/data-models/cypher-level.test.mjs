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

const { default: CypherCypherData } =
  await import("../../module/data-models/item-cypher.mjs");

test("cypher schema keeps effect level separate from power level", () => {
  const schema = CypherCypherData.defineSchema();

  assert.ok(schema.level);
  assert.equal(schema.level.options.initial, null);
  assert.equal(schema.level.options.nullable, true);
  assert.ok(schema.powerLevel);
  assert.deepEqual(schema.powerLevel.options.choices, [
    "", "low", "medium", "advanced", "high", "ultra"
  ]);
});

test("legacy textual cypher levels migrate to numbers", () => {
  assert.deepEqual(CypherCypherData.migrateData({ level: "6" }), { level: 6 });
  assert.deepEqual(CypherCypherData.migrateData({ level: "" }), { level: null });
});

test("numeric cypher levels are preserved", () => {
  assert.deepEqual(CypherCypherData.migrateData({ level: 6 }), { level: 6 });
});
