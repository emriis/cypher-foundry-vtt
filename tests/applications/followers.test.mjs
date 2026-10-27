import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { registerFollower, synchronizeFollower, configureFollower, replaceFollower, followerDisplay,
  followerTaskPlan, reconcileFollower, followerCanAct } from "../../module/applications/follower-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let pc, npc, documents, next;
const slot = () => Object.values(pc.flags.cypher.followers)[0];
function creature(id) { return { type: "npc", uuid: `Actor.${id}`, name: id, isOwner: true, flags: {},
  system: { level: 2, health: { max: 6, value: 4 } }, async update(changes) { applyDocumentUpdate(this, changes); } }; }
beforeEach(() => {
  next = 0; pc = { type: "pc", uuid: "Actor.pc", isOwner: true, flags: {}, system: { tier: 2 },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  npc = creature("scout"); documents = new Map([[pc.uuid, pc], [npc.uuid, npc]]);
  globalThis.fromUuid = async uuid => documents.get(uuid);
  globalThis.foundry = { utils: { randomID: () => `slot${++next}` } };
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } } };
});
async function register() { assert.equal(await registerFollower(pc, npc, { confirmed: true, source: "Declared CRD grant", taskLevels: [{ id: "perception", label: "Perception", level: 4 }] }), true); }

test("registration requires an explicit source and confirmation; tier gains retain actual damage and apply once", async () => {
  assert.equal(await registerFollower(pc, npc, { source: "Grant" }), false); assert.deepEqual(pc.flags, {});
  await register(); pc.system.tier = 4;
  assert.equal(await synchronizeFollower(pc, slot().id), true);
  assert.deepEqual(npc.system, { level: 3, health: { max: 9, value: 7 } });
  assert.equal((await followerDisplay(pc))[0].tasks[0].level, 5);
  pc.flags = JSON.parse(JSON.stringify(pc.flags)); npc.flags = JSON.parse(JSON.stringify(npc.flags));
  assert.equal(await synchronizeFollower(pc, slot().id), true); assert.equal(npc.system.health.value, 7);
  pc.system.tier = 8; await synchronizeFollower(pc, slot().id); assert.equal(npc.system.level, 5); assert.equal(npc.system.health.value, 13);
});

test("independent help respects attack/defense choice and task modifications without consuming PC cooperative help", async () => {
  await register();
  assert.equal((await followerTaskPlan(pc, [{ id: slot().id }], { isAttack: true })).assets, 1);
  assert.equal(await followerTaskPlan(pc, [{ id: slot().id }], { defenseType: "block" }), null);
  pc.system.tier = 4; await synchronizeFollower(pc, slot().id);
  assert.equal((await followerTaskPlan(pc, [{ id: slot().id, taskId: "perception" }])).assets, 2);
  assert.equal(await followerCanAct(npc), false);
  await configureFollower(pc, slot().id, { mode: "independent" });
  assert.equal(await followerCanAct(npc), true);
  assert.equal(await followerTaskPlan(pc, [{ id: slot().id }]), null);
  await configureFollower(pc, slot().id, { available: false }); assert.equal(await followerCanAct(npc), false);
});

test("an uncertain NPC write resumes after reload without increasing Health twice", async () => {
  await register(); pc.system.tier = 4; const update = npc.update;
  npc.update = async changes => { await update.call(npc, changes); throw Error("uncertain response"); };
  await assert.rejects(synchronizeFollower(pc, slot().id), /uncertain response/);
  assert.equal(npc.system.health.value, 7); assert.equal(slot().state, "pending");
  pc.flags = JSON.parse(JSON.stringify(pc.flags)); npc.update = update;
  assert.equal(await synchronizeFollower(pc, slot().id), true); assert.equal(npc.system.health.value, 7);
});

test("a replacement preserves acquisition tier, progression and extra improvements on an actual synthetic Actor", async () => {
  await register(); pc.system.tier = 4; await synchronizeFollower(pc, slot().id);
  await configureFollower(pc, slot().id, { extraLevels: 1 });
  const replacement = creature("replacement"); replacement.uuid = "Scene.s.Token.t.Actor.replacement"; documents.set(replacement.uuid, replacement);
  assert.equal(await replaceFollower(pc, slot().id, replacement, { confirmed: true }), true);
  assert.equal(replacement.system.level, 4); assert.equal(replacement.system.health.max, 12);
  assert.equal(slot().acquiredTier, 2); assert.deepEqual(slot().previous, [npc.uuid]);
  pc.system.tier = 6; await synchronizeFollower(pc, slot().id); assert.equal(replacement.system.level, 5);
  assert.equal(npc.system.level, 4);
  assert.equal(await followerCanAct(npc), true);
});

test("manual numeric edits require reconciliation; ownership rejection grants no help or writes", async () => {
  await register(); npc.system.health.max = 8;
  assert.equal(await synchronizeFollower(pc, slot().id), false); assert.equal(slot().state, "manual");
  assert.equal(await reconcileFollower(pc, slot().id), false);
  assert.equal(await reconcileFollower(pc, slot().id, { confirmed: true, note: "Verified custom Health" }), true);
  assert.equal(npc.system.health.max, 8);
  npc.isOwner = false; pc.system.tier = 4;
  assert.equal(await synchronizeFollower(pc, slot().id), false); assert.equal(npc.system.level, 2);
  assert.equal(await followerTaskPlan(pc, [{ id: slot().id }]), null);
});

test("an unconscious follower cannot provide help despite an earlier availability declaration", async () => {
  await register(); npc.flags.cypher.generalEffects = [{ kind: "unconscious" }];
  assert.equal((await followerTaskPlan(pc)).assets, 0);
  assert.equal(await followerTaskPlan(pc, [{ id: slot().id }]), null);
  npc.flags.cypher.generalEffects = [];
  assert.equal((await followerTaskPlan(pc)).assets, 1);
});
