import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { configureCompanion, companionTaskPlan, companionTargetDefense } from "../../module/applications/companion-power-service.mjs";
import { startAutomatonRepair, finishAutomatonRepair, interceptRetainer, finishRetainerInterception } from "../../module/applications/companion-support-service.mjs";
import { followerTaskPlan, restoreFollowerAvailability } from "../../module/applications/follower-service.mjs";
import { applyFollowerAbility } from "../../module/applications/follower-ability-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { rollTask } from "../../module/applications/task-service.mjs";
import { rollRecovery } from "../../module/applications/recovery-service.mjs";
let pc, npc, documents, next;
function ability(key) { const id = `item${++next}`; pc.items.set(id, { id, type: "ability", name: key, system: { key }, parent: pc }); return id; }
const slot = () => Object.values(pc.flags.cypher.followers)[0];
beforeEach(async () => {
  next = 0; pc = { uuid: "Actor.pc", type: "pc", isOwner: true, items: new Map(), flags: {}, system: { tier: 2, stats: { intellect: { pool: { value: 10, max: 10 }, edge: 1 } } }, async update(changes) { applyDocumentUpdate(this, changes); } };
  npc = { uuid: "Scene.s.Token.t.Actor.beast", type: "npc", isOwner: true, name: "Beast", flags: {}, system: { level: 2, health: { value: 4, max: 6 }, armor: 1 }, async update(changes) { applyDocumentUpdate(this, changes); } };
  documents = new Map([[pc.uuid, pc], [npc.uuid, npc]]);
  globalThis.fromUuid = async uuid => documents.get(uuid);
  globalThis.foundry = { utils: { randomID: () => `id${++next}`, escapeHTML: value => value } };
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, time: { worldTime: 0 }, i18n: { localize: key => key } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  await applyFollowerAbility(pc, ability("beast-companion"), { confirmed: true, followers: [{ npcUuid: npc.uuid, healthPerLevel: 3 }] });
});
test("declared immediate companion benefits apply once, disappear when unavailable and use source keys", async () => {
  ability("stronger-together"); ability("beast-betterment");
  assert.equal(await configureCompanion(pc, { followerId: slot().id, immediate: true, confirmed: true }), true);
  const plan = await companionTaskPlan(pc, { isAttack: true });
  assert.equal(plan.damage, 2); assert.equal(plan.recovery, 3);
  assert.equal((await companionTaskPlan(pc, { defenseType: "dodge" })).assets, 1);
  npc.system.health.value = 0;
  assert.equal((await companionTaskPlan(pc, { isAttack: true })).damage, 0);
  assert.equal((await companionTaskPlan(pc)).recovery, 3);
});

test("Stronger Together needs a conscious helper while Betterment preserves a declared living unconscious companion", async () => {
  ability("stronger-together"); ability("beast-betterment");
  await configureCompanion(pc, { followerId: slot().id, immediate: true, confirmed: true });
  assert.equal(await companionTargetDefense(npc), 1);
  npc.flags.cypher.generalEffects = [{ kind: "unconscious" }]; slot().available = false;
  assert.equal((await companionTaskPlan(pc, { defenseType: "dodge" })).assets, 0);
  assert.equal((await companionTaskPlan(pc)).recovery, 3);
  assert.equal(await companionTargetDefense(npc), 0);
  npc.statuses = new Set(["dead"]);
  assert.equal((await companionTaskPlan(pc)).recovery, 0);
});

test("calmed beasts give Stronger Together but not Betterment and losing friendliness ends their benefit", async () => {
  ability("stronger-together"); ability("beast-betterment"); ability("soothe-the-savage");
  assert.equal(await configureCompanion(pc, { calmedNpcUuid: npc.uuid, immediate: true, confirmed: true }), true);
  assert.equal((await companionTaskPlan(pc, { isAttack: true })).damage, 2);
  assert.equal((await companionTaskPlan(pc)).recovery, 0);
  await configureCompanion(pc, { calmedNpcUuid: npc.uuid, immediate: true, friendly: false, confirmed: true });
  assert.equal((await companionTaskPlan(pc, { isAttack: true })).damage, 0);
});

test("mounted movement grants its one asset while the mount acts independently, without also supplying ordinary help", async () => {
  slot().sourceAbility.family = "mount"; slot().mode = "independent"; ability("mount");
  await configureCompanion(pc, { followerId: slot().id, riding: true, confirmed: true });
  const plan = await companionTaskPlan(pc, { isAttack: true });
  assert.equal(plan.assets, 1); assert.equal(plan.mounted, true);
  assert.deepEqual(await followerTaskPlan(pc, [{ id: slot().id }], { isAttack: true, excludedIds: [plan.followerId] }), { assets: 0, sources: [] });
});

test("context linking resumes an uncertain NPC response without source guessing; replacement invalidates the declaration", async () => {
  ability("stronger-together"); const update = npc.update;
  npc.update = async changes => { await update.call(npc, changes); throw Error("uncertain link"); };
  await assert.rejects(configureCompanion(pc, { followerId: slot().id, immediate: true, confirmed: true }), /uncertain link/);
  assert.equal((await companionTaskPlan(pc, { isAttack: true })).damage, 0);
  npc.update = update; pc.flags = JSON.parse(JSON.stringify(pc.flags));
  await configureCompanion(pc, { followerId: slot().id, immediate: true, confirmed: true });
  assert.equal((await companionTaskPlan(pc, { isAttack: true })).damage, 2);
  slot().npcUuid = "Actor.replacement";
  assert.equal((await companionTaskPlan(pc, { isAttack: true })).damage, 0);
});

function source(key, family) { ability(key); slot().sourceAbility.key = key; slot().sourceAbility.family = family; }

test("automaton attention needs declared elapsed work, restores only two Health and resumes uncertain writes once", async () => {
  source("automaton-assistant", "automaton");
  assert.equal(await startAutomatonRepair(pc, slot().id, { durationSeconds: 180, confirmed: false }), false);
  assert.equal(await startAutomatonRepair(pc, slot().id, { durationSeconds: 180, confirmed: true }), true);
  const id = Object.keys(pc.flags.cypher.companionRepairs)[0];
  assert.equal(await finishAutomatonRepair(pc, id, { workConfirmed: true }), false);
  game.time.worldTime = 180;
  assert.equal(await finishAutomatonRepair(pc, id), false);
  const update = npc.update;
  npc.update = async changes => { await update.call(npc, changes); throw Error("uncertain repair"); };
  await assert.rejects(finishAutomatonRepair(pc, id, { workConfirmed: true }), /uncertain repair/);
  assert.equal(npc.system.health.value, 6);
  pc.flags = JSON.parse(JSON.stringify(pc.flags)); npc.update = update;
  npc.system.health.value = 5;
  assert.equal(await finishAutomatonRepair(pc, id, { workConfirmed: true }), true);
  assert.equal(npc.system.health.value, 5);
  assert.equal(pc.flags.cypher.companionRepairs[id].state, "complete");
});

test("a destroyed automaton, unknown Fleet repair and unauthorized targets cannot be repaired", async () => {
  source("automaton-assistant", "automaton"); npc.system.health.value = 0;
  assert.equal(await startAutomatonRepair(pc, slot().id, { durationSeconds: 180, confirmed: true }), false);
  npc.system.health.value = 4; npc.isOwner = false;
  assert.equal(await startAutomatonRepair(pc, slot().id, { durationSeconds: 180, confirmed: true }), false);
  npc.isOwner = true; source("automaton-fleet", "automaton");
  assert.equal(await startAutomatonRepair(pc, slot().id, { durationSeconds: 180, confirmed: true }), false);
});

test("a pending repair completes with zero restoration after an unrelated full heal, preserving current Health", async () => {
  source("automaton-assistant", "automaton");
  await startAutomatonRepair(pc, slot().id, { durationSeconds: 180, confirmed: true });
  game.time.worldTime = 180;
  const id = Object.keys(pc.flags.cypher.companionRepairs)[0], update = npc.update;
  npc.update = async () => { throw Error("write rejected"); };
  await assert.rejects(finishAutomatonRepair(pc, id, { workConfirmed: true }), /write rejected/);
  npc.update = update; npc.system.health.value = 6;
  assert.equal(await finishAutomatonRepair(pc, id, { workConfirmed: true }), true);
  assert.equal(npc.system.health.value, 6);
  assert.equal(npc.flags.cypher.companionRepairs[id].restored, 0);
  assert.equal(pc.flags.cypher.companionRepairs[id].state, "complete");
});

test("cancelling while completion awaits the actual NPC cannot accept cancellation and then heal anyway", async () => {
  source("automaton-assistant", "automaton");
  await startAutomatonRepair(pc, slot().id, { durationSeconds: 180, confirmed: true });
  game.time.worldTime = 180;
  const id = Object.keys(pc.flags.cypher.companionRepairs)[0];
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  globalThis.fromUuid = async uuid => { entered(); await gate; return documents.get(uuid); };
  const finishing = finishAutomatonRepair(pc, id, { workConfirmed: true }); await ready;
  const cancelled = await finishAutomatonRepair(pc, id, { cancel: true }); release();
  assert.equal(await finishing, true);
  assert.equal(cancelled, false);
  assert.equal(npc.system.health.value, 6);
});

test("Retainer spends discounted Intellect once and only damages the actual synthetic NPC; zero Health is unconscious", async () => {
  source("retainer", "retainer");
  const attacker = { uuid: "Actor.attacker", type: "npc", isOwner: true, flags: {}, async update(changes) { applyDocumentUpdate(this, changes); } }, update = npc.update;
  documents.set(attacker.uuid, attacker);
  npc.update = async changes => { await update.call(npc, changes); throw Error("uncertain interception"); };
  await assert.rejects(interceptRetainer(pc, slot().id, { attacker, amount: 8, confirmed: true }), /uncertain interception/);
  assert.equal(pc.system.stats.intellect.pool.value, 9); assert.equal(npc.system.health.value, 0);
  const id = Object.keys(pc.flags.cypher.retainerInterceptions)[0];
  assert.ok(npc.flags.cypher.generalEffects.some(effect => effect.kind === "unconscious"));
  npc.update = update; pc.flags = JSON.parse(JSON.stringify(pc.flags));
  assert.equal(await finishRetainerInterception(pc, id), true);
  assert.equal(pc.system.stats.intellect.pool.value, 9); assert.equal(slot().available, false);
  assert.equal(attacker.flags.cypher.weaponActionRevision, 1);
  assert.equal(await finishRetainerInterception(pc, id), true);
  assert.equal(attacker.flags.cypher.weaponActionRevision, 1);
  npc.system.health.value = 6;
  await restoreFollowerAvailability(pc, npc.uuid);
  assert.equal(slot().available, true); assert.deepEqual(npc.flags.cypher.generalEffects, []);
});

test("Retainer rejects insufficient resources, missing adjudication, non-GM and unconscious owner before writes", async () => {
  source("retainer", "retainer");
  const attacker = { uuid: "Actor.attacker", type: "npc", isOwner: true }, before = JSON.stringify(npc);
  assert.equal(await interceptRetainer(pc, slot().id, { attacker, amount: 4 }), false);
  pc.system.stats.intellect.pool.value = 0;
  assert.equal(await interceptRetainer(pc, slot().id, { attacker, amount: 4, confirmed: true }), false);
  pc.system.stats.intellect.pool.value = 10; game.user.isGM = false;
  assert.equal(await interceptRetainer(pc, slot().id, { attacker, amount: 4, confirmed: true }), false);
  game.user.isGM = true; pc.flags.cypher.generalEffects = [{ kind: "unconscious" }];
  assert.equal(await interceptRetainer(pc, slot().id, { attacker, amount: 4, confirmed: true }), false);
  assert.equal(JSON.stringify(npc), before);
});

test("the task engine caps combined assets, snapshots companion damage, and reverses an NPC defense asset", async () => {
  ability("stronger-together"); await configureCompanion(pc, { followerId: slot().id, immediate: true, confirmed: true });
  pc.system.effort = 1; pc.system.stats.intellect.pool.max = 30;
  game.i18n.format = key => key;
  const messages = [];
  globalThis.Roll = class { async evaluate() { this.total = 15; return this; } async toMessage(message) { messages.push(message); return message; } };
  const result = await rollTask(pc, { stat: "intellect", difficulty: 3, isAttack: true, baseDamage: 2, assetSteps: 2 });
  assert.equal(result.damage, 4); assert.equal(messages[0].flags.cypher.effectiveDifficulty, 1);
  assert.equal(messages[0].flags.cypher.baseDamage, 4);
  assert.equal(messages[0].flags.cypher.companionBenefits.damage, 2);
  const foe = { ...pc, uuid: "Actor.foe", items: new Map(), flags: {} };
  await rollTask(foe, { stat: "intellect", difficulty: 2, isAttack: true, baseDamage: 0, targetActor: npc });
  assert.equal(messages[1].flags.cypher.effectiveDifficulty, 3);
});

test("Betterment enters the recovery roll data once and stale allocation circumstances commit no recovery", async () => {
  ability("beast-betterment"); await configureCompanion(pc, { followerId: slot().id, immediate: true, confirmed: true });
  pc.system.stats.intellect.pool = { value: 0, max: 30 };
  pc.system.recoveries = {};
  pc.system.wounds = Object.fromEntries(["minor", "moderate", "major"].map(key => [key, { current: 0, max: 3 }]));
  const messages = [];
  globalThis.Roll = class { constructor(_formula, data) { this.data = data; } async evaluate() { this.total = 1 + this.data.tier + this.data.bonus; return this; } async toMessage(message) { messages.push(message); } };
  await rollRecovery(pc, "hour");
  assert.equal(pc.system.stats.intellect.pool.value, 6);
  assert.equal(messages[0].flags.cypher.rollData.bonus, 3);
  const before = pc.system.stats.intellect.pool.value;
  assert.equal(await rollRecovery(pc, "tenMinutes", { allocate: async ({ proposed }) => {
    pc.flags.cypher.companionContext.immediate = false; return proposed;
  } }), null);
  assert.equal(pc.system.stats.intellect.pool.value, before);
  assert.equal(pc.system.recoveries.tenMinutes, undefined);
});
