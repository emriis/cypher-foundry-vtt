import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { prepareObjectAttack, applyObjectConsequences, reconcileObjectConsequences,
  damageObject, resetObject, stampObjectRevision } from "../../module/applications/object-service.mjs";
import { rollTask } from "../../module/applications/task-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let actor, target, messages, die, dice;
const physical = { method: "physicalTool", toolHardEnough: true };
beforeEach(() => {
  messages = new Map(); die = 18; dice = 0;
  globalThis.game = { messages, user: { id: "user", isGM: true }, i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.foundry = { utils: { escapeHTML: value => value } };
  function publish(data) {
    const message = { ...data, id: String(messages.size + 1), isOwner: true,
      getFlag(scope, key) { return this.flags?.[scope]?.[key]; },
      async update(changes) { applyDocumentUpdate(this, changes); } };
    messages.set(message.id, message); return message;
  }
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => publish(data) };
  globalThis.Roll = class { async evaluate() { dice++; this.total = die; return this; } async toMessage(data) { return publish(data); } };
  actor = { type: "pc", id: "pc", uuid: "Actor.pc", isOwner: true, flags: {}, items: new Map(),
    system: { tier: 1, effort: 2, hinderSteps: 0, armor: {}, customStats: [], xp: 5,
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { edge: 0, pool: { value: 20, max: 20 } }])) },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  target = { type: "object", id: "door", uuid: "Scene.scene.Token.door.Actor.door", isOwner: true, flags: {},
    name: "Door", system: { originalLevel: 6, levelDamage: 0, destructionDamage: 0, physical: true, material: "steel" },
    async update(changes) { stampObjectRevision(this, changes); applyDocumentUpdate(this, changes); } };
  globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : uuid === target.uuid ? target : null;
});
const attack = options => rollTask(actor, { isAttack: true, targetActor: target, baseDamage: 7,
  objectInteraction: physical, ...options });

test("object attacks enforce current level before costs and apply level damage without NPC Health", async () => {
  die = 16; await attack({ difficulty: 0 });
  assert.equal(target.system.levelDamage, 0); // Level 6, not caller-supplied routine difficulty.
  die = 18; await attack();
  assert.equal(target.system.levelDamage, 3); // 7 + natural-18 bonus 2 - Armor 6.
  assert.equal(target.system.health, undefined);
});

test("missing/stale material declarations, destroyed targets and permissions reject before costs/dice", async () => {
  for (const objectInteraction of [null, { method: "physicalTool" }, { ...physical, revision: 4 }, { ...physical, targetUuid: "Actor.other" }]) {
    assert.equal(await attack({ objectInteraction, effortLevels: 1 }), null);
  }
  target.isOwner = false; assert.equal(await attack({ effortLevels: 1 }), null);
  target.isOwner = true; target.system.levelDamage = 6; target.system.destructionDamage = 6;
  assert.equal(await attack({ effortLevels: 1 }), null);
  assert.equal(actor.system.stats.might.pool.value, 20); assert.equal(dice, 0);
});

test("soft tools spend accepted task costs but have no effect; only actual weapon mechanics bypass protection", async () => {
  await attack({ objectInteraction: { ...physical, toolHardEnough: false }, effortLevels: 1 });
  assert.equal(actor.system.stats.might.pool.value, 17); assert.equal(target.system.levelDamage, 0);
  assert.equal(prepareObjectAttack(actor, target, { method: "physicalTool", cutLevel: 6 }), null);
  actor.items.set("blade", { id: "blade", type: "attack", system: { mechanics: { cutsThroughMaterialsLevel: 6 } } });
  const plan = prepareObjectAttack(actor, target, { method: "physicalTool" }, { itemId: "blade" });
  const result = await applyObjectConsequences(target, plan, true, 2);
  assert.equal(result.targetDamage, 2); assert.equal(result.objectConsequences.cuts, true);
  assert.equal(prepareObjectAttack(actor, target, physical, { itemId: "missing" }), null);
});

test("broken-object hits destroy only on later damage and explicit GM reset preserves the Actor", async () => {
  assert.equal(await damageObject(target, 100), true);
  assert.equal(target.system.levelDamage, 6); assert.equal(target.system.destructionDamage, 0);
  await damageObject(target, 6); assert.equal(target.system.destructionDamage, 6);
  assert.equal(await damageObject(target, 1), false);
  assert.equal(await resetObject(target), false);
  game.user.isGM = false; assert.equal(await resetObject(target, { confirmed: true }), false);
  game.user.isGM = true; assert.equal(await resetObject(target, { confirmed: true }), true);
  assert.equal(target.system.levelDamage, 0); assert.equal(target.system.destructionDamage, 0);
  assert.equal(target.uuid, "Scene.scene.Token.door.Actor.door");
});

test("serialized reroll history replaces its last contribution, including restoring a broken object", async () => {
  const plan = prepareObjectAttack(actor, target, physical);
  const first = await applyObjectConsequences(target, plan, true, 100);
  const flags = JSON.parse(JSON.stringify(first)); let checkpoints = 0;
  const correction = await reconcileObjectConsequences(target, flags, { success: false, totalDamage: 0 }, async pending => {
    assert.equal(pending.state, "pending"); checkpoints++;
  });
  assert.equal(target.system.levelDamage, 0); assert.equal(checkpoints, 1);
  const second = await reconcileObjectConsequences(target, correction, { success: true, totalDamage: 7 }, async () => {});
  assert.equal(target.system.levelDamage, 1); assert.equal(second.objectConsequences.state, "applied");
});

test("later hits, restored material edits and pending writes require manual correction without erasing changes", async () => {
  const first = await applyObjectConsequences(target, prepareObjectAttack(actor, target, physical), true, 7);
  await damageObject(target, 7); const before = structuredClone(target.system);
  const result = await reconcileObjectConsequences(target, first, { success: false }, async () => assert.fail());
  assert.equal(result.objectConsequences.reason, "changed"); assert.deepEqual(target.system, before);
  const pending = await reconcileObjectConsequences(target, { objectConsequences: { ...first.objectConsequences, state: "pending" } }, {}, async () => assert.fail());
  assert.equal(pending.objectConsequences.reason, "partial");
});

test("material edits invalidate attribution even after restoring the original text", async () => {
  const first = await applyObjectConsequences(target, prepareObjectAttack(actor, target, physical), true, 7);
  await target.update({ "system.material": "glass" });
  await target.update({ "system.material": "steel" });
  const result = await reconcileObjectConsequences(target, first, { success: false }, async () => assert.fail());
  assert.equal(result.objectConsequences.reason, "changed"); assert.equal(target.system.levelDamage, 1);
});

test("an interrupted correction keeps a durable checkpoint and cannot replay an uncertain target write", async () => {
  const first = await applyObjectConsequences(target, prepareObjectAttack(actor, target, physical), true, 7);
  const update = target.update; let pending;
  target.update = async () => { throw Error("interrupted write"); };
  await assert.rejects(reconcileObjectConsequences(target, first, { success: false }, async value => { pending = value; }), /interrupted write/);
  assert.equal(pending.state, "pending"); assert.equal(target.system.levelDamage, 1);
  target.update = update;
  const result = await reconcileObjectConsequences(target, { objectConsequences: pending }, { success: false }, async () => assert.fail());
  assert.equal(result.objectConsequences.reason, "partial"); assert.equal(target.system.levelDamage, 1);
});

test("target changes while the die is resolving are preserved and recorded for manual reconciliation", async () => {
  const plan = prepareObjectAttack(actor, target, physical);
  await target.update({ "system.levelDamage": 2 });
  const result = await applyObjectConsequences(target, plan, true, 100);
  assert.equal(result.objectConsequences.state, "manual"); assert.equal(target.system.levelDamage, 2);
});

test("revision stamping handles dotted and expanded edits, ignoring unrelated or unchanged fields", () => {
  const unchanged = { "system.material": "steel", name: "Other" }; stampObjectRevision(target, unchanged);
  assert.equal(unchanged["flags.cypher.objectRevision"], undefined);
  const expanded = { system: { material: "glass" } }; stampObjectRevision(target, expanded);
  assert.equal(expanded["flags.cypher.objectRevision"], 1);
  const dotted = { "system.levelDamage": 1 }; stampObjectRevision(target, dotted);
  assert.equal(dotted["flags.cypher.objectRevision"], 1);
});

test("paid XP rerolls resolve the saved synthetic target and keep ordinary costs, with the natural-20 exception", async () => {
  die = 2; await attack({ effortLevels: 1 });
  const source = [...messages.values()].at(-1);
  assert.equal(actor.system.stats.might.pool.value, 17);
  die = 18; await rerollMessage(actor, source);
  assert.ok(target.system.levelDamage > 0); assert.equal(actor.system.xp, 4);
  assert.equal(actor.system.stats.might.pool.value, 17);
  die = 20; await rerollMessage(actor, source);
  assert.equal(actor.system.stats.might.pool.value, 20); assert.equal(actor.system.xp, 3);
  await rerollMessage(actor, source);
  assert.equal(actor.system.stats.might.pool.value, 20); assert.equal(actor.system.xp, 2);
});
