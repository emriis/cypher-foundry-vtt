import assert from "node:assert/strict";
import test from "node:test";

class Field {
  constructor(options = {}) { this.options = options; }
}
class ArrayField extends Field {
  constructor(element, options = {}) { super(options); this.element = element; }
}
class SchemaField extends Field {
  constructor(fields, options = {}) { super(options); this.fields = fields; }
}

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: {
    StringField: Field,
    NumberField: Field,
    HTMLField: Field,
    BooleanField: Field,
    DocumentUUIDField: Field,
    ArrayField,
    SchemaField
  }}
};

const [{ default: Ability }, { default: Type }, { default: Focus }, { default: Descriptor }] =
  await Promise.all([
    import("../../module/data-models/item-ability.mjs"),
    import("../../module/data-models/item-type.mjs"),
    import("../../module/data-models/item-focus.mjs"),
    import("../../module/data-models/item-descriptor.mjs")
  ]);

test("standalone ability action model exposes only supported categories", () => {
  const schema = Ability.defineSchema();
  assert.deepEqual(schema.action.options.choices, ["action", "firstAction", "lastAction"]);
  assert.equal(schema.action.options.initial, null);
  assert.equal(schema.action.options.nullable, true);
});

test("older Ability Items default to no passive benefit without changing effect state", () => {
  const schema = Ability.defineSchema();
  assert.deepEqual(schema.passiveModifiers.options.initial, []);
  assert.equal(schema.passiveModifiers.options.required, true);
  assert.ok(schema.passiveModifiers.element.fields.kind.options.choices.includes("woundCapacity"));
  assert.ok(schema.passiveModifiers.element.fields.kind.options.choices.includes("shieldWoundCapacity"));
  assert.equal(schema.passiveModifiers.element.fields.minimumRank.options.initial, 0);
});

test("older Descriptor benefits hydrate with an empty modifier definition", () => {
  const benefit = Descriptor.defineSchema().benefits.element.fields;
  assert.deepEqual(benefit.passiveModifiers.options.initial, []);
  assert.ok(benefit.passiveModifiers.element.fields.kind.options.choices.includes("woundCapacity"));
  assert.ok(benefit.name);
  assert.ok(benefit.description);
});

test("Types store ability UUID references rather than embedded ability data", () => {
  const schema = Type.defineSchema();
  assert.equal(schema.abilities.element.options.type, "Item");
  assert.ok(!schema.abilities.element.fields);
});

test("Foci store ability UUID references and an external flowchart", () => {
  const schema = Focus.defineSchema();
  assert.equal(schema.abilities.element.options.type, "Item");
  assert.ok(schema.flowchart);
  assert.ok(schema.flowchart.fields.edges);
});

test("ability model owns focus-specific mechanical grants", () => {
  const schema = Ability.defineSchema();
  for (const field of [
    "freeWeaponCategories",
    "freeArmorCategories",
    "freeWeaponFamilies",
    "freeWeaponSkillCategories",
    "chooseWeaponAttackCategory",
    "grantedArmorItemCategory"
  ]) assert.ok(schema[field], field);
});

test("ability effects can preserve tier-specific CRD improvements", () => {
  const schema = Ability.defineSchema();
  const effect = schema.effects.element;
  assert.ok(effect.fields.tier);
  assert.equal(effect.fields.tier.options.nullable, true);
  assert.equal(effect.fields.tier.options.min, 1);
  assert.equal(effect.fields.tier.options.max, 6);
});


test("ability model stores structured weapon prerequisite alternatives", () => {
  const schema = Ability.defineSchema();
  const prerequisite = schema.weaponPrerequisites.element;
  assert.deepEqual(prerequisite.fields.kind.options.choices, [
    "rapidFire", "thrownWeaponsInReach", "weaponCategory", "weaponFamily"
  ]);
  assert.ok(prerequisite.fields.alternativeGroup);
  assert.ok(prerequisite.fields.value);
});
