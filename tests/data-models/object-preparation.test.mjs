import assert from "node:assert/strict";
import test from "node:test";
class Field { constructor(options) { this.options = options; } }
globalThis.foundry = { abstract: { TypeDataModel: class {} }, data: { fields:
  Object.fromEntries(["NumberField", "StringField", "HTMLField", "BooleanField"].map(name => [name, Field])) } };
const { default: ObjectData } = await import("../../module/data-models/actor-object.mjs");

test("Object preparation derives level/status without wounds, Health or document writes", () => {
  const schema = ObjectData.defineSchema();
  assert.equal(schema.originalLevel.options.initial, 1);
  assert.equal(schema.physical.options.initial, true);
  assert.equal(schema.wounds, undefined); assert.equal(schema.health, undefined);
  const object = Object.assign(Object.create(ObjectData.prototype), { originalLevel: 6,
    levelDamage: 1, destructionDamage: 0, physical: true,
    update() { assert.fail("Preparation cannot persist updates"); } });
  assert.equal(object.level, 5); assert.equal(object.targetNumber, 15); assert.equal(object.status, "functional");
  object.levelDamage = 6; assert.equal(object.status, "broken");
  object.destructionDamage = 6; assert.equal(object.status, "destroyed");
  object.levelDamage = 1; assert.equal(object.status, "invalid");
});
