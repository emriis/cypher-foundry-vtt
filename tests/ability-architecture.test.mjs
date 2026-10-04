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

const [{ default: Ability }, { default: Type }, { default: Focus }] =
  await Promise.all([
    import("../module/data-models/item-ability.mjs"),
    import("../module/data-models/item-type.mjs"),
    import("../module/data-models/item-focus.mjs")
  ]);

test("standalone ability action model exposes only supported categories", () => {
  const schema = Ability.defineSchema();
  assert.deepEqual(schema.action.options.choices, ["action", "firstAction", "lastAction"]);
  assert.equal(schema.action.options.initial, null);
  assert.equal(schema.action.options.nullable, true);
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
