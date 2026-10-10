// CRD: Spending Experience Points > Lucky Shot. Rejected requests are not actions.
import assert from "node:assert/strict";
import test from "node:test";
import { rollTask } from "../../module/applications/task-service.mjs";
import { chooseAbilityEffect } from "../../module/applications/ability-service.mjs";

function scenario({ pool = 0, xp = 2 } = {}) {
  const messages = [];
  globalThis.game = { i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    async evaluate() { this.total = 10; return this; }
    async toMessage(message) { messages.push(message); }
  };
  const actor = {
    type: "pc", items: new Map(), updates: [],
    system: { xp, effort: 1, activeAbilityEffects: [],
      stats: { might: { pool: { value: pool, max: 10 }, edge: 0 } } },
    async update(changes) {
      this.updates.push(changes);
      for (const [key, value] of Object.entries(changes)) {
        const parts = key.split("."); let data = this;
        for (const part of parts.slice(0, -1)) data = data[part];
        data[parts.at(-1)] = value;
      }
    }
  };
  return { actor, messages };
}

test("Given insufficient Pool, when Lucky Shot with Effort is requested, then neither XP nor Pool is spent", async () => {
  const { actor, messages } = scenario();
  assert.equal(await rollTask(actor, { isAttack: true, luckyShot: true, effortLevels: 1 }), null);
  assert.equal(actor.system.xp, 2);
  assert.equal(actor.system.stats.might.pool.value, 0);
  assert.deepEqual(actor.updates, []);
  assert.deepEqual(messages, []);
});

test("Given an unknown stat, when Lucky Shot is requested, then validation rejects it before spending", async () => {
  const { actor } = scenario({ pool: 10 });
  assert.equal(await rollTask(actor, { stat: "unknown", isAttack: true, luckyShot: true }), null);
  assert.equal(actor.system.xp, 2);
  assert.deepEqual(actor.updates, []);
});

test("Given a target the user cannot update, when an attack is requested, then resources remain untouched", async () => {
  const { actor } = scenario({ pool: 10 });
  const target = { type: "npc", isOwner: false,
    system: { armor: 0, health: { value: 10, max: 10 } },
    async update() { assert.fail("A forbidden target must never be written"); } };
  assert.equal(await rollTask(actor, { isAttack: true, luckyShot: true, baseDamage: 4,
    targetActor: target, difficulty: 0, effortLevels: 1 }), null);
  assert.equal(actor.system.xp, 2);
  assert.deepEqual(actor.updates, []);
});

test("Given enough resources, when Lucky Shot with Effort resolves, then both costs are committed together", async () => {
  const { actor } = scenario({ pool: 10 });
  const result = await rollTask(actor, { isAttack: true, luckyShot: true, effortLevels: 1, difficulty: 0 });
  assert.equal(result.effectiveDifficulty, 3);
  assert.equal(actor.system.xp, 1);
  assert.equal(actor.system.stats.might.pool.value, 7);
  assert.equal(actor.updates.length, 1);
  assert.deepEqual(actor.updates[0], { "system.xp": 1, "system.stats.might.pool.value": 7 });
});

test("Given a target write failure, when an attack resolves, then it throws before publishing success chat", async () => {
  const { actor, messages } = scenario({ pool: 10 });
  const target = { type: "npc", system: { armor: 0, health: { value: 10, max: 10 } },
    async update() { throw new Error("target write failed"); } };
  await assert.rejects(rollTask(actor, { isAttack: true, baseDamage: 4, difficulty: 0,
    effortLevels: 1, luckyShot: true, targetActor: target }), /target write failed/);
  assert.equal(actor.system.xp, 1, "a later failure does not roll back committed XP");
  assert.equal(actor.system.stats.might.pool.value, 7, "committed Pool cost remains visible for reconciliation");
  assert.deepEqual(messages, []);
  assert.ok(await rollTask(actor, { difficulty: 0 }), "a failed action releases its guard");
});

test("Given overlapping task requests, when both are activated, then only one commits costs", async () => {
  const { actor } = scenario({ pool: 10 });
  const results = await Promise.all([rollTask(actor, { effortLevels: 1 }), rollTask(actor, { effortLevels: 1 })]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(actor.system.stats.might.pool.value, 7);
});

test("Given overlapping ongoing Ability activation, when clicked twice, then its cost and effect are applied once", async () => {
  const { actor, messages } = scenario({ pool: 10 });
  actor.system.activeAbilityEffects = [];
  const item = { type: "ability", actor, parent: actor, uuid: "Actor.pc.Item.ability",
    system: { cost: { stat: "might", amount: 2 }, effects: [{ id: "effect",
      endConditions: [{ kind: "recovery", interval: "hour" }] }] } };
  globalThis.foundry = { applications: { ux: { TextEditor: { implementation: { enrichHTML: async v => v } } } } };
  globalThis.ChatMessage.create = async message => messages.push(message);
  const results = await Promise.all([chooseAbilityEffect(item, "effect"), chooseAbilityEffect(item, "effect")]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(actor.system.stats.might.pool.value, 8);
  assert.equal(actor.system.activeAbilityEffects.length, 1);
});
