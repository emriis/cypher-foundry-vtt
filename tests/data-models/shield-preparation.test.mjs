/** Shield Master derives an independent track without persisting Item updates. */
import assert from "node:assert/strict";
import test from "node:test";

class Field {}
globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: Object.fromEntries(["SchemaField", "NumberField", "HTMLField", "BooleanField", "StringField"].map(name => [name, Field])) }
};
const { default: Shield } = await import("../../module/data-models/item-shield.mjs");

test("shield capacity follows the actual owner's Items and preserves wounds after removal", () => {
  const actor = { system: {}, items: [] };
  const shield = Object.assign(Object.create(Shield.prototype), {
    parent: { actor }, wounds: {
      minor: { current: 0, max: 3 }, moderate: { current: 3, max: 2 }, major: { current: 0, max: 1 }
    }, update() { assert.fail("Derived preparation cannot persist changes"); }
  });
  actor.items.push({ type: "ability", system: { passiveModifiers: [
    { kind: "shieldWoundCapacity", severity: "moderate", amount: 1 }
  ] } });
  shield.prepareDerivedData();
  shield.prepareDerivedData();
  assert.equal(shield.effectiveWounds.moderate.max, 3);
  assert.equal(shield.wounds.moderate.max, 2);
  assert.equal(shield.broken, false);
  actor.items = [];
  shield.prepareDerivedData();
  assert.equal(shield.effectiveWounds.moderate.max, 2);
  assert.equal(shield.wounds.moderate.current, 3);
  delete shield.parent.actor;
  shield.prepareDerivedData();
  assert.equal(shield.effectiveWounds.moderate.max, 2);
});

test("a major wound marks a shield broken regardless of a customized maximum", () => {
  const shield = Object.assign(Object.create(Shield.prototype), { wounds: {
    minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 1, max: 3 }
  } });
  shield.prepareDerivedData();
  assert.equal(shield.broken, true);
  assert.equal(shield.wounds.major.max, 3);
});

test("a source designation changes derived destruction only, and older shield data keeps safe defaults", () => {
  const actor = { system: {}, items: [{ id: "a", type: "ability", system: { key: "unyielding-shield" } }] };
  const shield = Object.assign(Object.create(Shield.prototype), { abilityItemId: "a", wounds: {
    minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 1, max: 1 }
  }, update() { assert.fail("Preparation must not write"); } });
  shield.parent = { actor, system: shield };
  shield.prepareDerivedData();
  assert.equal(shield.broken, false);
  assert.equal(shield.wounds.major.current, 1);
  delete shield.abilityItemId;
  shield.prepareDerivedData();
  assert.equal(shield.broken, true);
});
