import assert from "node:assert/strict";
import test from "node:test";

class FieldDefinition {
  constructor(options = {}) {
    this.options = options;
  }
}

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: {
    StringField: FieldDefinition,
    NumberField: FieldDefinition,
    HTMLField: FieldDefinition,
    BooleanField: FieldDefinition,
    ArrayField: FieldDefinition,
    SchemaField: FieldDefinition
  }}
};

const { default: CypherAttackData } =
  await import("../../module/data-models/item-attack.mjs");

test("weapon schema exposes structured mechanics without removing source properties", () => {
  const schema = CypherAttackData.defineSchema();

  assert.ok(schema.properties);
  assert.ok(schema.mechanics);
  assert.equal(schema.mechanics.options.twoHanded.options.initial, false);
  assert.equal(schema.mechanics.options.rapidFire.options.initial, false);
  assert.equal(
    schema.mechanics.options.ignoresPhysicalArmor.options.initial,
    0
  );
  assert.equal(
    schema.mechanics.options.cutsThroughMaterialsLevel.options.nullable,
    true
  );
  assert.ok(schema.mechanics.options.targetEffects);
});

test("weapon target effects keep level ranges and explicit effect semantics", () => {
  const targetEffects =
    CypherAttackData.defineSchema().mechanics.options.targetEffects;

  assert.ok(targetEffects.options.element);
  assert.deepEqual(
    targetEffects.options.element.options.effect.options.choices,
    ["", "loseNextAction", "hindered"]
  );
  assert.equal(
    targetEffects.options.element.options.maximumTargetLevel.options.nullable,
    true
  );
});

test("weapon configuration mechanics keep tripod and alternate configuration data", () => {
  const mechanics = CypherAttackData.defineSchema().mechanics.options;

  assert.equal(mechanics.requiresTripod.options.initial, false);
  assert.equal(mechanics.requiredOperators.options.initial, 0);
  assert.equal(
    mechanics.alternateConfiguration.options.attackType.options.choices,
    ["", "light", "medium", "heavy"]
  );
  assert.deepEqual(
    mechanics.alternateConfiguration.options.action.options.choices,
    ["", "action"]
  );
});
