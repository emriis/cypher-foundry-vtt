import assert from "node:assert/strict";
import test from "node:test";
import { executeWeaponAbility } from "../../module/applications/weapon-ability-service.mjs";
import { rollTask } from "../../module/applications/task-service.mjs";

function scenario(kind, d20 = 10) {
  const messages = [];
  globalThis.foundry = { utils: { escapeHTML: value => value } };
  globalThis.game = { i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { this.total = this.formula === "1d6" ? 5 : d20; return this; }
    async toMessage(message) { messages.push(message); }
  };
  async function update(changes) {
    for (const [path, value] of Object.entries(changes)) {
      const parts = path.split(".");
      let data = this;
      for (const part of parts.slice(0, -1)) data = data[part];
      data[parts.at(-1)] = value;
    }
  }
  const actor = { id: "pc", type: "pc", name: "PC", items: new Map(), update,
    system: { effort: 1, stats: { speed: { pool: { value: 10, max: 10 }, edge: 1 } } },
    rollTask(options) { return rollTask(this, options); } };
  const ability = { id: "ability", type: "ability", name: kind, parent: actor, actor,
    system: { key: kind, cost: { stat: "speed", amount: kind === "spray" ? 2 : 3 } } };
  const weapon = { id: "weapon", type: "attack", name: "Weapon", actor, update,
    system: { stat: "speed", attackType: "medium", damage: 4, freelyUsable: true,
      availableUses: 2, mechanics: { rapidFire: true } } };
  actor.items.set(ability.id, ability);
  actor.items.set(weapon.id, weapon);
  const targets = [1, 2, 3].map(index => ({ id: `target-${index}`, type: "npc", name: `Target ${index}`,
    system: { level: 1, armor: 1, health: { value: 10, max: 10 } }, update,
    getFlag() { return []; } }));
  return { actor, ability, weapon, targets, messages };
}

test("given Spray and Effort, the full attack pipeline spends combined costs and applies reduced damage after Armor", async () => {
  const context = scenario("spray");
  const result = await executeWeaponAbility(context.ability, { weaponId: "weapon", targets: [context.targets[0]],
    rollOptions: { effortLevels: 1 } });
  assert.equal(context.actor.system.stats.speed.pool.value, 6, "2 activation + 3 Effort - 1 Edge");
  assert.equal(result.results[0].damage, 3);
  assert.equal(context.targets[0].system.health.value, 8);
  assert.equal(context.weapon.system.availableUses, 0);
  assert.equal(context.messages.at(-1).flags.cypher.abilitySource.kind, "spray");
});

test("given Arc Spray, three attacks apply target damage and separate extra-action Effort costs", async () => {
  const context = scenario("arc-spray");
  const result = await executeWeaponAbility(context.ability, { weaponId: "weapon", targets: context.targets,
    allAdjacent: true, rollOptions: { effortLevels: 1 } });
  assert.equal(result.results.length, 3);
  assert.equal(context.actor.system.stats.speed.pool.value, 1, "3 activation + 3 first Effort - 1 Edge + 2 + 2");
  assert.deepEqual(context.targets.map(target => target.system.health.value), [7, 7, 7]);
  assert.deepEqual(result.results.map(result => result.effectiveDifficulty), [1, 1, 1]);
});

test("given a natural 20 on Spray, activation and Effort are refunded but ammunition is consumed", async () => {
  const context = scenario("spray", 20);
  await executeWeaponAbility(context.ability, { weaponId: "weapon", targets: [context.targets[0]],
    rollOptions: { effortLevels: 1 } });
  assert.equal(context.actor.system.stats.speed.pool.value, 10);
  assert.equal(context.weapon.system.availableUses, 0);
});

test("Given insufficient Pool for the next Arc Spray action, then no die or target mutation occurs for that action", async () => {
  const context = scenario("arc-spray");
  context.actor.system.stats.speed.pool.value = 6;
  const result = await executeWeaponAbility(context.ability, { weaponId: "weapon", targets: context.targets,
    allAdjacent: true, rollOptions: { effortLevels: 1 } });
  assert.equal(result.results.length, 1);
  assert.equal(context.actor.system.stats.speed.pool.value, 1);
  assert.deepEqual(context.targets.map(target => target.system.health.value), [7, 10, 10]);
  assert.equal(context.messages.length, 1, "only the accepted attack rolled and published chat");
});

test("Given a natural twenty on each action, then its refund funds later attacks without an aggregate prepayment", async () => {
  const context = scenario("arc-spray", 20);
  context.actor.system.stats.speed.pool.value = 5;
  const result = await executeWeaponAbility(context.ability, { weaponId: "weapon", targets: context.targets,
    allAdjacent: true, rollOptions: { effortLevels: 1, specialEffectChoice: "damage" } });
  assert.equal(result.completed, true);
  assert.equal(result.results.length, 3);
  assert.equal(context.actor.system.stats.speed.pool.value, 5);
});

test("Given extra Arc Spray actions, then fresh choices are validated before each action and cancellation spends nothing", async () => {
  const context = scenario("arc-spray");
  const prompts = [];
  const result = await executeWeaponAbility(context.ability, { weaponId: "weapon", targets: context.targets,
    allAdjacent: true, rollOptions: { effortLevels: 1 },
    chooseAttackOptions: async ({ index }) => { prompts.push(index); return index === 1 ? { effortLevels: 0 } : null; } });
  assert.equal(result.completed, false);
  assert.deepEqual(prompts, [1, 2]);
  assert.equal(context.actor.system.stats.speed.pool.value, 5, "only activation and the first action's Effort cost points");
  assert.deepEqual(context.targets.map(target => target.system.health.value), [7, 7, 10]);
  assert.equal(context.messages.length, 2);
});

test("Given an ordinary free grant declared for the first action, then a macro cannot reuse that declaration on extra actions", async () => {
  const context = scenario("arc-spray");
  const result = await executeWeaponAbility(context.ability, { weaponId: "weapon", targets: context.targets,
    allAdjacent: true, rollOptions: { freeEffortLevels: 1, freeEffortSource: "Confirmed CRD grant" } });
  assert.deepEqual(result.results.map(result => result.effectiveDifficulty), [1, 2, 2]);
});
