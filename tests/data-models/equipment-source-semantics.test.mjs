import assert from "node:assert/strict";
import test from "node:test";

class Field { constructor(options = {}) { this.options = options; } }
globalThis.foundry = { abstract: { TypeDataModel: class {} }, data: { fields: {
  NumberField: Field, StringField: Field, BooleanField: Field, HTMLField: Field, SchemaField: Field
} } };
const { default: Equipment } = await import("../../module/data-models/item-equipment.mjs");
const { default: Shield } = await import("../../module/data-models/item-shield.mjs");

test("CRD equipment models preserve explicit source-level semantics", () => {
  const schema = Equipment.defineSchema();
  assert.equal(schema.level.options.nullable, true);
  assert.equal(schema.level.options.initial, null);
  assert.ok(schema.priceCategory.options.choices.includes("moderate"));
});

test("CRD shield records can preserve their price category", () => {
  assert.ok(Shield.defineSchema().priceCategory.options.choices.includes("moderate"));
});

test("equipment migration preserves explicit depletion bounds and unrelated data on repeated hydration", () => {
  const source = { depletionThreshold: 2, depletionMin: 1, depletionMax: 3, description: "Keep this" };
  const once = structuredClone(Equipment.migrateData(source));
  assert.deepEqual(once, { depletionMin: 1, depletionMax: 3, description: "Keep this" });
  assert.deepEqual(Equipment.migrateData(source), once);
});
