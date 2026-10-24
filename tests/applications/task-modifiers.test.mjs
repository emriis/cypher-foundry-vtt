// CRD > Easing Tasks, Free Level of Effort, Special Rolls, and Superheroes Genre.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { rollTask } from "../../module/applications/task-service.mjs";
import { rollAttack } from "../../module/applications/item-service.mjs";
import { chooseAbilityEffect } from "../../module/applications/ability-service.mjs";

let messages, dice, die;
beforeEach(() => {
  messages = []; dice = 0; die = 12;
  globalThis.game = { i18n: { localize: key => key, format: key => key }, user: { targets: new Set() } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.foundry = { utils: { escapeHTML: value => value }, applications: { ux: { TextEditor: {
    implementation: { enrichHTML: async value => value }
  } } } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => messages.push(message) };
  globalThis.Roll = class {
    async evaluate() { dice += 1; this.total = die; return this; }
    async toMessage(message) { messages.push(message); }
  };
});

function pc({ effort = 3, edge = 1 } = {}) {
  return { id: "pc", uuid: "Actor.pc", type: "pc", isOwner: true, items: new Map(), flags: {}, updates: [],
    system: { effort, rank: 1, genre: "none", hinderSteps: 0, armor: {}, customStats: [],
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { edge, pool: { value: 20, max: 20 } }])) },
    async update(changes) {
      this.updates.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const keys = path.split("."); let cursor = this;
        for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {};
        cursor[keys.at(-1)] = value;
      }
    },
    rollTask(options) { return rollTask(this, options); }
  };
}

test("Given matching weapon training, when the real attack pipeline runs, then skill is counted once", async () => {
  for (const [level, steps] of [["trained", 1], ["specialized", 2], ["expert", 3]]) {
    const actor = pc();
    actor.items.set("skill", { type: "skill", system: { level, stepModifier: steps, attackCategory: "mediumBladed" } });
    const weapon = { type: "attack", flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 2 } } }, actor, name: "Sword", system: {
      stat: "might", damage: 4, attackType: "medium", attackSkillCategory: "mediumBladed", freelyUsable: true
    } };
    const result = await rollAttack(weapon, { difficulty: 6, skillItemId: "skill" });
    assert.equal(result.effectiveDifficulty, 6 - steps);
  }
});

test("Given split Effort, when an attack hits, then damage and easing share one limit and one Edge", async () => {
  const actor = pc();
  const result = await rollTask(actor, { difficulty: 5, isAttack: true, baseDamage: 4,
    effortLevels: 1, damageEffortLevels: 2 });
  assert.equal(result.effectiveDifficulty, 4);
  assert.equal(result.damage, 10);
  assert.equal(actor.system.stats.might.pool.value, 14);
  assert.equal(await rollTask(actor, { isAttack: true, effortLevels: 2, damageEffortLevels: 2 }), null);
});

test("Given ordinary free Effort, then it bypasses the score but not the combined six-level ceiling", async () => {
  const actor = pc({ effort: 1 });
  const result = await rollTask(actor, { difficulty: 6, effortLevels: 1, freeEffortLevels: 2,
    freeEffortSource: "Confirmed applicable CRD ability" });
  assert.equal(result.effectiveDifficulty, 3);
  assert.equal(actor.system.stats.might.pool.value, 18);
  assert.equal(await rollTask(actor, { freeEffortLevels: 1 }), null, "free levels require a declared source");
  assert.equal(await rollTask(pc({ effort: 6 }), { effortLevels: 5, freeEffortLevels: 2,
    freeEffortSource: "Confirmed applicable CRD ability" }), null);
});

test("Given a routine task, when the player declines dice, then success spends Effort without special results or rerolls", async () => {
  const actor = pc();
  const result = await rollTask(actor, { difficulty: 1, effortLevels: 1, rollRoutine: false });
  assert.equal(result.success, true);
  assert.equal(result.roll, null);
  assert.equal(dice, 0);
  assert.equal(actor.system.stats.might.pool.value, 18);
  assert.equal(messages[0].flags.cypher.rerollable, false);
  await rollTask(actor, { difficulty: 0, rollRoutine: true });
  assert.equal(dice, 1);
});

test("Given malformed modifiers, then rejection precedes costs, dice and chat", async () => {
  for (const options of [{ effortLevels: 1.5 }, { effortLevels: NaN }, { assetSteps: Infinity },
    { extraEaseSteps: 0.5 }, { difficulty: NaN }, { damageEffortLevels: 1 }]) {
    const actor = pc();
    assert.equal(await rollTask(actor, options), null);
    assert.deepEqual(actor.updates, []);
  }
  assert.equal(dice, 0); assert.deepEqual(messages, []);
});

test("Given an impossible task, when a natural twenty fails, then its Pool cost is still refunded", async () => {
  die = 20; const actor = pc();
  const result = await rollTask(actor, { difficulty: 8, effortLevels: 1 });
  assert.equal(result.success, false);
  assert.equal(actor.system.stats.might.pool.value, 20);
});

test("Given a nineteen attack, then the player's special-effect choice precedes persisted damage", async () => {
  die = 19; const actor = pc();
  let choices;
  const result = await rollTask(actor, { isAttack: true, baseDamage: 4,
    chooseSpecialEffect: async options => { choices = options; return "minor"; } });
  assert.deepEqual(choices, ["damage", "minor"]);
  assert.equal(result.damage, 4);
  assert.equal(messages[0].flags.cypher.specialEffectChoice, "minor");
});

test("Given a generic Ability costing three with Edge two, then activation spends one Pool point", async () => {
  const actor = pc({ edge: 2 });
  const item = { type: "ability", actor, parent: actor, system: {
    cost: { stat: "might", amount: 3 }, effects: [{ id: "effect", name: "Effect", description: "CRD effect" }]
  } };
  assert.equal(await chooseAbilityEffect(item, "effect"), true);
  assert.equal(actor.system.stats.might.pool.value, 19);
});

test("Given Accuracy shifts, then attacks gain permanent easing outside the Effort ceiling", async () => {
  const actor = pc({ effort: 6 }); actor.system.genre = "superhero";
  actor.system.powerShifts = { accuracy: 2 };
  const result = await rollTask(actor, { difficulty: 10, effortLevels: 6, isAttack: true, baseDamage: 4 });
  assert.equal(result.effectiveDifficulty, 2);
});

test("Given owned Superheroics and a chosen Pool, then only that Pool receives rank and push costs a real wound", async () => {
  const actor = pc({ effort: 6 }); actor.system.rank = 2;
  actor.flags.cypher = { superheroicsStat: "might" };
  actor.items.set("hero", { type: "ability", system: { key: "superheroics" } });
  actor.system.wounds = { minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 3 } };
  assert.equal((await rollTask(actor, { difficulty: 10, effortLevels: 7 })).effectiveDifficulty, 3);
  actor.system.stats.might.pool.value = 20;
  assert.equal(await rollTask(actor, { stat: "speed", push: true }), null);
  const result = await rollTask(actor, { difficulty: 4, push: true, effortLevels: 1 });
  assert.equal(result.effectiveDifficulty, 1);
  assert.equal(actor.system.wounds.moderate.current, 1);
  assert.equal(actor.system.stats.might.pool.value, 18);
});
