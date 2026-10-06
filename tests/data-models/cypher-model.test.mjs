import assert from "node:assert/strict";
import test from "node:test";

class Field { constructor(options = {}) { this.options = options; } }
class ArrayField extends Field {
  constructor(element, options = {}) { super(options); this.element = element; }
}
class SchemaField extends Field {
  constructor(fields, options = {}) { super(options); this.fields = fields; }
}

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: {
    StringField: Field, NumberField: Field, HTMLField: Field,
    BooleanField: Field, ArrayField, SchemaField
  }}
};

const { default: Cypher } = await import("../../module/data-models/item-cypher.mjs");

test("Cypher model keeps effect level separate from power level", () => {
  const schema = Cypher.defineSchema();
  assert.equal(schema.level.options.nullable, true);
  assert.deepEqual(schema.powerLevel.options.choices, ["", "low", "medium", "advanced", "high", "ultra"]);
});

test("Cypher model stores variable manifest powers and random tables", () => {
  const schema = Cypher.defineSchema();
  assert.ok(schema.powerLevels);
  assert.ok(schema.randomRange);
  assert.ok(schema.variants);
  assert.ok(schema.rollTables);
  assert.ok(schema.rollTables.element.fields.results);
});
