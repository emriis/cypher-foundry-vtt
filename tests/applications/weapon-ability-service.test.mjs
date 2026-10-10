import assert from "node:assert/strict";
import test from "node:test";
import { executeWeaponAbility, getWeaponAbilityKind } from "../../module/applications/weapon-ability-service.mjs";
import { computeEffortCost } from "../../module/rules/tasks.mjs";

function setup(kind = "spray", { uses = 2, rapidFire = true, speed = 20, edge = 0, d20 = 10 } = {}) {
  const calls = [], messages = [], warnings = [];
  globalThis.game = { i18n: { localize: key => key, format: (key, args) => `${key}:${args.uses}` } };
  globalThis.ui = { notifications: { warn: text => warnings.push(text) } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    async evaluate() { this.total = 5; return this; }
    async toMessage(message) { messages.push(message); }
  };
  const actor = {
    id: "pc", type: "pc",
    system: { stats: { speed: { pool: { value: speed, max: 20 }, edge } }, effort: 2 },
    items: new Map(),
    async update(change) {
      for (const [path, value] of Object.entries(change)) {
        assert.equal(path, "system.stats.speed.pool.value");
        this.system.stats.speed.pool.value = value;
      }
    },
    async rollTask(options) {
      calls.push(options);
      const charge = computeEffortCost(options.effortLevels ?? 0, Math.max(0, edge - options.spentAbilityEdge));
      if (d20 !== 20) this.system.stats.speed.pool.value -= charge;
      return { success: true, damage: options.baseDamage, roll: { total: d20 } };
    }
  };
  const weapon = {
    id: "weapon", type: "attack", name: "Weapon", actor,
    system: { stat: "speed", attackType: "medium", damage: 4, freelyUsable: true,
      mechanics: { rapidFire }, availableUses: uses },
    async update(change) { this.system.availableUses = change["system.availableUses"]; }
  };
  const item = {
    id: "ability", type: "ability", name: "Localized ability", actor, parent: actor,
    system: { key: kind, cost: { stat: "speed", amount: kind === "spray" ? 2 : 3 } }
  };
  actor.items.set(weapon.id, weapon);
  actor.items.set(item.id, item);
  const targets = [1, 2, 3].map(level => ({ id: `npc-${level}`, type: "npc", system: { level } }));
  return { item, actor, weapon, targets, calls, messages, warnings };
}

test("Spray consumes the capped store, charges once, and modifies a normal weapon attack", async () => {
  const context = setup();
  const result = await executeWeaponAbility(context.item, { weaponId: "weapon", targets: [context.targets[0]] });
  assert.equal(result.spray.requestedUses, 6);
  assert.equal(context.weapon.system.availableUses, 0);
  assert.equal(context.actor.system.stats.speed.pool.value, 18);
  assert.equal(context.calls.length, 1);
  assert.equal(context.calls[0].assetSteps, 1);
  assert.equal(context.calls[0].baseDamage, 3);
  assert.equal(context.calls[0].targetActor, context.targets[0]);
  assert.equal(context.messages[0].flags.cypher.abilitySource.usesToConsume, 2);
});

test("Arc Spray executes three distinct target-level attacks with one hindrance each and one Ability charge", async () => {
  const context = setup("arc-spray");
  const result = await executeWeaponAbility(context.item, { weaponId: "weapon", targets: context.targets, allAdjacent: true });
  assert.equal(result.results.length, 3);
  assert.equal(context.actor.system.stats.speed.pool.value, 17);
  assert.equal(context.weapon.system.availableUses, 2, "Arc Spray does not invent a source-unspecified ammunition count");
  assert.deepEqual(context.calls.map(call => call.difficulty), [1, 2, 3]);
  assert.deepEqual(context.calls.map(call => call.extraHinderSteps), [1, 1, 1]);
  assert.deepEqual(context.calls.map(call => call.targetActor.id), context.targets.map(target => target.id));
});

test("invalid weapon, empty store, and insufficient aggregate costs leave state untouched", async () => {
  for (const options of [{ uses: 0 }, { rapidFire: false }, { speed: 1 }]) {
    const context = setup("spray", options);
    const before = context.actor.system.stats.speed.pool.value;
    assert.equal(await executeWeaponAbility(context.item, { weaponId: "weapon", targets: [context.targets[0]] }), null);
    assert.equal(context.actor.system.stats.speed.pool.value, before);
    assert.equal(context.weapon.system.availableUses, options.uses ?? 2);
    assert.equal(context.calls.length, 0);
    assert.equal(context.messages.length, 0);
  }
  const context = setup("arc-spray", { speed: 8 });
  assert.equal(await executeWeaponAbility(context.item, { weaponId: "weapon", targets: context.targets,
    allAdjacent: true, rollOptions: { effortLevels: 1 } }), null);
  assert.equal(context.actor.system.stats.speed.pool.value, 8);
});

test("Arc Spray rejects duplicated targets and unconfirmed adjacency before spending", async () => {
  for (const adjacent of [false, true]) {
    const context = setup("arc-spray");
    const targets = adjacent ? [context.targets[0], context.targets[0], context.targets[2]] : context.targets;
    assert.equal(await executeWeaponAbility(context.item, { weaponId: "weapon", targets, allAdjacent: adjacent }), null);
    assert.equal(context.calls.length, 0);
    assert.equal(context.actor.system.stats.speed.pool.value, 20);
  }
});

test("Spray supports explicitly declared thrown weapons and an untracked store", async () => {
  const context = setup("spray", { uses: null, rapidFire: false });
  const result = await executeWeaponAbility(context.item, { weaponId: "weapon", targets: [context.targets[0]], thrownWeaponsInReach: true });
  assert.equal(result.spray.usesToConsume, 6);
  assert.equal(context.weapon.system.availableUses, null);
});

test("Ability dispatch uses stable keys and rejects foreign ownership", async () => {
  const context = setup();
  context.item.name = "Arc Spray";
  assert.equal(getWeaponAbilityKind(context.item), "spray");
  context.item.parent = {};
  assert.equal(await executeWeaponAbility(context.item, { weaponId: "weapon", targets: [context.targets[0]] }), null);
  assert.equal(context.calls.length, 0);
});

test("Spray applies Edge once to its combined activation and Effort cost", async () => {
  const context = setup("spray", { speed: 5, edge: 2 });
  assert.ok(await executeWeaponAbility(context.item, { weaponId: "weapon", targets: [context.targets[0]],
    rollOptions: { effortLevels: 1 } }));
  assert.equal(context.actor.system.stats.speed.pool.value, 2);
  assert.equal(context.calls[0].spentAbilityEdge, 2);
});

test("a natural 20 refunds the activation cost without restoring expended ammunition", async () => {
  const context = setup("spray", { speed: 5, d20: 20 });
  await executeWeaponAbility(context.item, { weaponId: "weapon", targets: [context.targets[0]],
    rollOptions: { effortLevels: 1 } });
  assert.equal(context.actor.system.stats.speed.pool.value, 5);
  assert.equal(context.weapon.system.availableUses, 0);
});

test("Arc Spray preserves distinct synthetic target Actors sharing a base ID", async () => {
  const context = setup("arc-spray");
  context.targets.forEach((target, index) => {
    target.id = "base-npc";
    target.uuid = `Scene.test.Token.${index}.Actor.base-npc`;
  });
  assert.ok(await executeWeaponAbility(context.item, { weaponId: "weapon", targets: context.targets, allAdjacent: true }));
  assert.equal(context.calls.length, 3);
});
