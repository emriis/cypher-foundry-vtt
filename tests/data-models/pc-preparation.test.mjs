/** Exercise the PC public preparation boundary without persisting derived data. */
import assert from "node:assert/strict";
import test from "node:test";
class StubField {}
globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: Object.fromEntries(["SchemaField", "NumberField", "StringField", "HTMLField", "BooleanField", "ArrayField"].map(name => [name, StubField])) }
};
const { default: CypherPCData } = await import("../../module/data-models/actor-pc.mjs");
function prepare(model) {
  model._prepareDerivedDataUnsafe = () => CypherPCData.prototype._prepareDerivedDataUnsafe.call(model);
  model._applyDerivedDataFallback = () => assert.fail("Valid preparation must not fall back");
  CypherPCData.prototype.prepareDerivedData.call(model);
}

test("repeated public PC preparation preserves Pools, wounds and embedded armor without document writes", () => {
  const armor = { id: "armor", type: "armor", name: "Armor", system: {
    equipped: true, category: "medium", blockEaseDamage: 1
  }, update() { assert.fail("Preparation must not persist Item updates"); } };
  const model = Object.assign(Object.create(CypherPCData.prototype), {
    stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 8, max: 8 }, edge: 0 }])),
    customStats: [], genre: "none", powerShifts: {}, advancementSlots: [],
    freeArmorCategories: ["medium"], canFreelyUseAllArmor: false,
    wounds: { minor: { current: 0, max: 3 }, moderate: { current: 1, max: 3 }, major: { current: 0, max: 3 } },
    parent: { items: [armor], update() { assert.fail("Preparation must not persist Actor updates"); } }
  });
  const pools = () => Object.values(model.stats).map(stat => stat.pool);
  const stored = structuredClone({ pools: pools(), wounds: model.wounds, armor: armor.system });
  model.prepareDerivedData();
  const prepared = structuredClone({ armor: model.armor, hinderSteps: model.hinderSteps });
  model.prepareDerivedData();
  assert.deepEqual({ armor: model.armor, hinderSteps: model.hinderSteps }, prepared);
  assert.deepEqual({ pools: pools(), wounds: model.wounds, armor: armor.system }, stored);
  model.parent.items.push({ type: "ability", system: { passiveModifiers: [
    { kind: "woundCapacity", severity: "minor", amount: 1 },
    { kind: "woundCapacity", severity: "moderate", amount: 1 }
  ] } });
  model.prepareDerivedData();
  model.prepareDerivedData();
  assert.equal(model.effectiveWounds.minor.max, 4);
  assert.equal(model.effectiveWounds.moderate.max, 4);
  assert.deepEqual(model.wounds, stored.wounds);
  model.parent.items.pop();
  model.prepareDerivedData();
  assert.equal(model.effectiveWounds.minor.max, 3);
  // Resilience/Armored Body capacity moves the full-track thresholds, while
  // existing major wounds still hinder individually under the core rule.
  model.parent.items.push({ type: "ability", system: { passiveModifiers: [
    { kind: "woundCapacity", severity: "moderate", amount: 1 },
    { kind: "woundCapacity", severity: "major", amount: 1 }
  ] } });
  model.wounds.moderate.current = 3;
  model.wounds.major.current = 3;
  model.prepareDerivedData();
  assert.equal(model.hinderSteps, 3);
  assert.equal(model.dead, false);
  model.wounds.moderate.current = 4;
  model.wounds.major.current = 4;
  model.prepareDerivedData();
  assert.equal(model.hinderSteps, 5);
  assert.equal(model.dead, true);
  assert.equal(model.wounds.major.max, 3);
});
test("armor free use is checked against the equipped armor's exact category", () => {
  const actorData = {
    stats: {
      might: { pool: { value: 8 } },
      speed: { pool: { value: 8 } },
      intellect: { pool: { value: 8 } }
    },
    customStats: [],
    wounds: {
      minor: { current: 0, max: 3 },
      moderate: { current: 0, max: 3 },
      major: { current: 0, max: 3 }
    },
    genre: "none",
    powerShifts: {},
    advancementSlots: [],
    freeArmorCategories: ["light"],
    canFreelyUseAllArmor: false,
    parent: {
      items: [{ type: "armor", id: "armor-id", name: "Chainmail", system: { equipped: true, category: "medium", blockEaseDamage: 0 } }]
    }
  };

  prepare(actorData);
  assert.equal(actorData.armor.freelyUsable, false);
  assert.equal(actorData.armor.dodgeHinder, 2);
  assert.equal(actorData.armor.speedTaskHinder, 2);

  actorData.freeArmorCategories = ["light", "medium"];
  prepare(actorData);
  assert.equal(actorData.armor.freelyUsable, true);
  assert.equal(actorData.armor.dodgeHinder, 2);
  assert.equal(actorData.armor.speedTaskHinder, 0);
});

test("armor derived dodge uses explicit encumbrance and CRD overrides", () => {
  const actorData = {
    stats: {
      might: { pool: { value: 8 } },
      speed: { pool: { value: 8 } },
      intellect: { pool: { value: 8 } }
    },
    customStats: [],
    wounds: {
      minor: { current: 0, max: 3 },
      moderate: { current: 0, max: 3 },
      major: { current: 0, max: 3 }
    },
    genre: "none",
    powerShifts: {},
    advancementSlots: [],
    freeArmorCategories: [],
    canFreelyUseAllArmor: false,
    parent: {
      items: [{
        type: "armor",
        id: "armor-id",
        name: "Elven chainmail",
        system: {
          equipped: true,
          category: "medium",
          encumbranceCategory: "light",
          blockEaseDamage: 0
        }
      }]
    }
  };

  prepare(actorData);
  assert.equal(actorData.armor.dodgeHinder, 1);
  assert.equal(actorData.armor.speedTaskHinder, 1);

  actorData.parent.items[0].system = {
    equipped: true,
    category: "light",
    blockEaseDamage: 0,
    dodgeHindrance: 0
  };
  prepare(actorData);
  assert.equal(actorData.armor.dodgeHinder, 0);
  assert.equal(actorData.armor.speedTaskHinder, 0);
});
