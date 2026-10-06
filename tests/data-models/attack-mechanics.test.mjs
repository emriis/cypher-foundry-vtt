import assert from "node:assert/strict";
import test from "node:test";

class FieldDefinition {
  constructor(options = {}) {
    this.options = options;
  }
}

class ArrayFieldDefinition extends FieldDefinition {
  constructor(element, options = {}) {
    super(options);
    this.element = element;
  }
}

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: {
    StringField: FieldDefinition,
    NumberField: FieldDefinition,
    HTMLField: FieldDefinition,
    BooleanField: FieldDefinition,
    ArrayField: ArrayFieldDefinition,
    SchemaField: FieldDefinition
  }}
};

const { default: CypherAttackData } =
  await import("../../module/data-models/item-attack.mjs");

test("weapon schema permits explicit special weapons without a light/medium/heavy category", () => {
  const schema = CypherAttackData.defineSchema();
  assert.equal(schema.attackType.options.nullable, true);
  assert.deepEqual(schema.attackType.options.choices, ["", "light", "medium", "heavy"]);
});

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

  assert.ok(targetEffects.element);
  assert.deepEqual(
    targetEffects.element.options.effect.options.choices,
    ["", "loseNextAction", "hindered"]
  );
  assert.equal(
    targetEffects.element.options.maximumTargetLevel.options.nullable,
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
