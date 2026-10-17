/** Public Actor compatibility APIs retain their historical rule/task contracts. */
import assert from "node:assert/strict";
import test from "node:test";
globalThis.Actor = class Actor {};
const { default: CypherActor } = await import("../../module/documents/actor.mjs");
test("computeEffortCost charges the first level, additional levels, and Edge once", () => {
  assert.equal(CypherActor.computeEffortCost(1), 3);
  assert.equal(CypherActor.computeEffortCost(3), 7);
  assert.equal(CypherActor.computeEffortCost(3, 2), 5);
  assert.equal(CypherActor.computeEffortCost(1, 5), 0);
});

test("computeEffortCost does not charge for zero or negative Effort", () => {
  assert.equal(CypherActor.computeEffortCost(0), 0);
  assert.equal(CypherActor.computeEffortCost(-1), 0);
});

test("getEligibleFocusAbilities allows any linked prerequisite to unlock a higher-tier Focus ability", () => {
  const focus = {
    abilities: [
      { id: "intimidating-presence", tier: 1, prerequisites: [], repeatable: false },
      { id: "stone-body", tier: 1, prerequisites: [], repeatable: false },
      { id: "stone-bash", tier: 2, prerequisites: ["intimidating-presence", "stone-body"], repeatable: false },
      { id: "golem-grip", tier: 2, prerequisites: ["stone-body"], repeatable: false }
    ]
  };

  const eligible = CypherActor.getEligibleFocusAbilities(focus, ["intimidating-presence"], 2);
  assert.deepEqual(eligible.map(ability => ability.id), ["stone-body", "stone-bash"]);
  assert.equal(CypherActor.isFocusAbilityEligible(focus, ["intimidating-presence"], "golem-grip", 2), false);
  assert.equal(CypherActor.isFocusAbilityEligible(focus, ["stone-body"], "stone-bash", 2), true);
  assert.equal(CypherActor.isFocusAbilityEligible(focus, ["intimidating-presence"], "stone-bash", 1), false);
});

test("reduceWoundSeverity lowers wounds by one tier", () => {
  const reduce = CypherActor.prototype._reduceWoundSeverity;

  assert.equal(reduce.call({}, "major"), "moderate");
  assert.equal(reduce.call({}, "moderate"), "minor");
  assert.equal(reduce.call({}, "minor"), null);
  assert.equal(reduce.call({}, "unknown"), null);
});

test("convertDamageToWound honors documented damage thresholds", () => {
  const convert = CypherActor.prototype._convertDamageToWound;

  assert.equal(convert.call({}, 1), "minor");
  assert.equal(convert.call({}, 4), "minor");
  assert.equal(convert.call({}, 5), "moderate");
  assert.equal(convert.call({}, 8), "moderate");
  assert.equal(convert.call({}, 9), "major");
});

test("rollDefense maps Block and Dodge to the correct stat and armor modifier", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.Roll = class {
    constructor() { this.total = 10; }
    async evaluate() { return this; }
    async toMessage() {}
  };
  const actor = {
    type: "pc",
    system: {
      armor: { blockEase: 1, dodgeHinder: 2 },
      stats: {
        might: { pool: { value: 10, max: 10 }, edge: 0 },
        speed: { pool: { value: 10, max: 10 }, edge: 0 },
        intellect: { pool: { value: 10, max: 10 }, edge: 0 }
      },
      effort: 1,
      hinderSteps: 0,
      wounds: {
        minor: { current: 0, max: 3 },
        moderate: { current: 0, max: 3 },
        major: { current: 0, max: 3 }
      }
    },
    items: new Map(),
    async update() {},
    async toggleStatusEffect() {}
  };

  const block = await CypherActor.prototype.rollDefense.call(actor, "block", {
    difficulty: 4,
    incomingSeverity: "moderate"
  });
  assert.equal(block.stat, "might");
  assert.equal(block.armorModifier, 1);
  assert.equal(block.defenseType, "block");
  assert.equal(block.incomingSeverity, "moderate");

  const dodge = await CypherActor.prototype.rollDefense.call(actor, "dodge", {
    difficulty: 5
  });
  assert.equal(dodge.stat, "speed");
  assert.equal(dodge.armorModifier, -2);
  assert.equal(dodge.defenseType, "dodge");
});
