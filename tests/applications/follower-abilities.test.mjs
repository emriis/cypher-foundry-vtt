import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { applyFollowerAbility, synchronizeFollowerAbility } from "../../module/applications/follower-ability-service.mjs";
import { followerDisplay, registerFollower, replaceFollower, synchronizeFollower } from "../../module/applications/follower-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let pc, documents, next;
function npc(id, level = 2) {
  const actor = { uuid: `Actor.${id}`, name: id, type: "npc", isOwner: true, flags: {},
    system: { level, health: { max: level * 3, value: level * 3 - 1 } },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  documents.set(actor.uuid, actor); return actor;
}
function ability(key, repeatable = false) {
  const id = `ability${++next}`, item = { id, uuid: `${pc.uuid}.Item.${id}`, type: "ability", name: "Localized name", isOwner: true,
    system: { key, repeatable }, parent: pc };
  pc.items.set(id, item); return id;
}
const choice = actor => ({ npcUuid: actor.uuid, healthPerLevel: 3 });
const slots = () => Object.values(pc.flags.cypher?.followers ?? {});
const uses = () => Object.values(pc.flags.cypher?.followerAbilityUses ?? {});
beforeEach(() => {
  next = 0; documents = new Map();
  pc = { uuid: "Actor.pc", type: "pc", isOwner: true, flags: {}, items: new Map(), system: { tier: 2 },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  documents.set(pc.uuid, pc);
  globalThis.fromUuid = async uuid => documents.get(uuid);
  globalThis.foundry = { utils: { randomID: () => `id${++next}` } };
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } } };
});

test("one acquired Ability copy grants once, with durable source identity and retained damage through tier growth", async () => {
  const id = ability("beast-companion", true), beast = npc("beast");
  assert.equal(await applyFollowerAbility(pc, id, { followers: [choice(beast)] }), false);
  assert.deepEqual(pc.flags, {});
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: [choice(beast)] }), true);
  assert.equal(slots()[0].sourceAbility.family, "beast");
  pc.flags = JSON.parse(JSON.stringify(pc.flags));
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: [choice(npc("other"))] }), false);
  pc.system.tier = 4; await synchronizeFollower(pc, slots()[0].id);
  assert.equal(beast.system.health.value, 8); assert.equal(uses()[0].state, "complete");
  const id2 = ability("beast-companion", true);
  assert.equal(await applyFollowerAbility(pc, id2, { confirmed: true, followers: [choice(npc("second"))] }), true);
});

test("a fleet validates the entire batch before writes, including duplicate and unauthorized synthetic owners", async () => {
  const id = ability("automaton-fleet"), fleet = [1, 2, 3, 4].map(i => npc(`auto${i}`));
  fleet[3].uuid = "Scene.scene.Token.token.Actor.auto4"; documents.set(fleet[3].uuid, fleet[3]); fleet[3].isOwner = false;
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: fleet.map(choice) }), false);
  assert.deepEqual(pc.flags, {}); assert.ok(fleet.every(actor => !actor.flags.cypher));
  fleet[3].isOwner = true;
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: [fleet[0], fleet[1], fleet[2], fleet[2]].map(choice) }), false);
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: fleet.map(choice) }), true);
  assert.equal(slots().length, 4); assert.equal(slots()[3].npcUuid, fleet[3].uuid);
});

test("partial fleet creation resumes after reload without duplicate slots, tier growth or Health gains", async () => {
  const id = ability("automaton-fleet"), fleet = [1, 2, 3, 4].map(i => npc(`auto${i}`));
  pc.system.tier = 4;
  const update = fleet[1].update;
  fleet[1].update = async changes => { await update.call(fleet[1], changes); throw Error("uncertain response"); };
  await assert.rejects(applyFollowerAbility(pc, id, { confirmed: true, acquiredTier: 2, followers: fleet.map(choice) }), /uncertain/);
  assert.equal(slots().length, 4); assert.equal(uses()[0].state, "pending");
  pc.flags = JSON.parse(JSON.stringify(pc.flags)); fleet[1].update = update;
  assert.equal(await synchronizeFollowerAbility(pc, uses()[0].id), true);
  assert.ok(fleet.every(actor => actor.system.level === 3 && actor.system.health.value === 8));
  assert.equal(await synchronizeFollowerAbility(pc, uses()[0].id), true);
  assert.equal(slots().length, 4);
});

test("Basic and Expert Follower enforce actual chosen task levels and charm identity", async () => {
  const id = ability("basic-follower", true), follower = npc("speaker"), input = choice(follower);
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: [input] }), false);
  input.taskLevels = [{ id: "charm", label: "Charme", level: 3 }, { id: "craft", label: "Craft", level: 3 }];
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: [input] }), true);
  const expert = ability("expert-follower", true), fresh = npc("new");
  assert.equal(await applyFollowerAbility(pc, expert, { confirmed: true, variant: "upgrade", followers: [choice(fresh)], upgrades: [{ id: slots()[0].id }] }), true);
  assert.equal(follower.system.level, 3); assert.equal(follower.system.health.value, 8);
  assert.deepEqual((await followerDisplay(pc))[0].tasks.map(task => task.level), [3, 3]);
});

test("Improved Companion limits three acquired copies and retains improvements on replacement", async () => {
  const beast = npc("beast");
  await applyFollowerAbility(pc, ability("beast-companion", true), { confirmed: true, followers: [choice(beast)] });
  for (let count = 0; count < 3; count++) assert.equal(await applyFollowerAbility(pc, ability("improved-companion", true), { confirmed: true, upgrades: [{ id: slots()[0].id }] }), true);
  assert.equal(beast.system.level, 5);
  assert.equal(await applyFollowerAbility(pc, ability("improved-companion", true), { confirmed: true, upgrades: [{ id: slots()[0].id }] }), false);
  const replacement = npc("replacement");
  await replaceFollower(pc, slots()[0].id, replacement, { confirmed: true });
  assert.equal(replacement.system.level, 5); assert.equal(slots()[0].sourceAbility.family, "beast");
});

test("wrong family, non-repeatable duplicates and non-elected GM cannot mutate", async () => {
  const beast = npc("beast"), id = ability("machine-companion");
  await applyFollowerAbility(pc, ability("beast-companion"), { confirmed: true, followers: [choice(beast)] });
  assert.equal(await applyFollowerAbility(pc, ability("automaton-evolution", true), { confirmed: true, upgrades: [{ id: slots()[0].id }] }), false);
  assert.equal(await applyFollowerAbility(pc, ability("beast-companion"), { confirmed: true, followers: [choice(npc("other"))] }), false);
  game.users.activeGM.id = "otherGM";
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: [choice(npc("machine", 3))] }), false);
});

test("Improved Follower uses initial acquisition level for the new task and only future improvements advance it", async () => {
  const beast = npc("beast");
  await applyFollowerAbility(pc, ability("beast-companion", true), { confirmed: true, followers: [choice(beast)] });
  pc.system.tier = 6; await synchronizeFollower(pc, slots()[0].id);
  const upgrade = ability("improved-follower", true);
  assert.equal(await applyFollowerAbility(pc, upgrade, { confirmed: true, upgrades: [{ id: slots()[0].id, newTask: { id: "track", label: "Tracking", level: 99 } }] }), true);
  assert.equal(beast.system.level, 5);
  assert.equal((await followerDisplay(pc))[0].tasks[0].level, 3);
  assert.equal(await applyFollowerAbility(pc, ability("improved-follower", true), { confirmed: true, upgrades: [{ id: slots()[0].id, newTask: { id: "swim", label: "Swimming" } }] }), false);
  pc.system.tier = 8; await synchronizeFollower(pc, slots()[0].id);
  assert.equal((await followerDisplay(pc))[0].tasks[0].level, 4);
  const replacement = npc("replacement"); await replaceFollower(pc, slots()[0].id, replacement, { confirmed: true });
  assert.equal((await followerDisplay(pc))[0].tasks[0].level, 4);
});

test("Mount alternative upgrades the beast, preserves its history and grants exactly one new beast", async () => {
  const beast = npc("beast");
  await applyFollowerAbility(pc, ability("beast-companion", true), { confirmed: true, followers: [choice(beast)] });
  const id = ability("mount"), fresh = npc("fresh");
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, variant: "upgrade", followers: [choice(fresh)], upgrades: [{ id: slots()[0].id }] }), true);
  assert.equal(slots()[0].sourceAbility.family, "mount"); assert.equal(slots()[0].acquiredTier, 2);
  assert.equal(slots()[1].sourceAbility.family, "beast"); assert.equal(beast.system.level, 3);
});

test("Improved Machine Companion may upgrade an existing machine without also granting a new one", async () => {
  const machine = npc("machine", 3);
  await applyFollowerAbility(pc, ability("machine-companion"), { confirmed: true, followers: [choice(machine)] });
  assert.equal(await applyFollowerAbility(pc, ability("improved-machine-companion"), { confirmed: true, variant: "upgrade", upgrades: [{ id: slots()[0].id }] }), true);
  assert.equal(slots().length, 1); assert.equal(machine.system.level, 5); assert.equal(machine.system.health.value, 14);
});

test("a beast already at level 3 can become a mount without losing earned progression or gaining another level", async () => {
  const beast = npc("beast");
  await applyFollowerAbility(pc, ability("beast-companion", true), { confirmed: true, followers: [choice(beast)] });
  pc.system.tier = 4; await synchronizeFollower(pc, slots()[0].id);
  assert.equal(beast.system.level, 3);
  const health = beast.system.health.value;
  assert.equal(await applyFollowerAbility(pc, ability("mount"), { confirmed: true, variant: "upgrade", followers: [choice(npc("fresh"))], upgrades: [{ id: slots()[0].id }] }), true);
  assert.equal(beast.system.level, 3); assert.equal(beast.system.health.value, health); assert.equal(slots()[0].sourceAbility.family, "mount");
});

test("explicit historical binding preserves the manual slot, Health, progression and availability without another creature", async () => {
  const beast = npc("legacy");
  await registerFollower(pc, beast, { confirmed: true, source: "Historical companion" });
  pc.system.tier = 4; await synchronizeFollower(pc, slots()[0].id);
  const original = JSON.parse(JSON.stringify(beast.system)), slot = slots()[0].id;
  const id = ability("beast-companion", true);
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, acquiredTier: 2, followers: [{ slotId: slot }] }), true);
  assert.deepEqual(beast.system, original); assert.equal(slots().length, 1);
  assert.equal(slots()[0].sourceAbility.family, "beast");
  assert.equal(await applyFollowerAbility(pc, ability("improved-companion", true), { confirmed: true, upgrades: [{ id: slot }] }), true);
  assert.equal(beast.system.level, 4);
});

test("an uncertain PC checkpoint resumes without the original Item and never allocates another slot", async () => {
  const beast = npc("beast"), id = ability("beast-companion", true), update = pc.update;
  pc.update = async changes => { await update.call(pc, changes); throw Error("uncertain checkpoint"); };
  await assert.rejects(applyFollowerAbility(pc, id, { confirmed: true, followers: [choice(beast)] }), /uncertain checkpoint/);
  assert.equal(slots().length, 1); assert.equal(beast.flags.cypher, undefined);
  pc.update = update; pc.items.delete(id); pc.flags = JSON.parse(JSON.stringify(pc.flags));
  assert.equal(await synchronizeFollowerAbility(pc, uses()[0].id), true);
  assert.equal(slots().length, 1); assert.equal(beast.system.health.value, 5);
});

test("simultaneous activation of one copy grants only once", async () => {
  const beast = npc("beast"), id = ability("beast-companion", true);
  const results = await Promise.all([1, 2].map(() => applyFollowerAbility(pc, id, { confirmed: true, followers: [choice(beast)] })));
  assert.deepEqual(results.sort(), [false, true]); assert.equal(slots().length, 1); assert.equal(uses().length, 1);
});

test("permissions, source tier and stale manual follower statistics are rejected without recording a benefit", async () => {
  const beast = npc("beast"), id = ability("beast-companion", true);
  game.user.isGM = false;
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: [choice(beast)] }), false);
  game.user.isGM = true; pc.items.get(id).system.tier = 3;
  assert.equal(await applyFollowerAbility(pc, id, { confirmed: true, followers: [choice(beast)] }), false);
  pc.items.get(id).system.tier = 1;
  await applyFollowerAbility(pc, id, { confirmed: true, followers: [choice(beast)] });
  const improved = ability("improved-companion", true); beast.system.level = 9;
  assert.equal(await applyFollowerAbility(pc, improved, { confirmed: true, upgrades: [{ id: slots()[0].id }] }), false);
  assert.equal(uses().length, 1); assert.equal(slots()[0].state, "active");
});

test("level-only automaton upgrades leave existing and newly granted modifications intact; future tier gains still advance them", async () => {
  const automaton = npc("automaton"), input = { ...choice(automaton), taskLevels: [{ id: "perception", label: "Perception", level: 4 }] };
  await applyFollowerAbility(pc, ability("automaton-assistant"), { confirmed: true, followers: [input] });
  const upgrade = () => applyFollowerAbility(pc, ability("automaton-evolution", true), { confirmed: true, upgrades: [{ id: slots()[0].id }] });
  await upgrade(); assert.equal((await followerDisplay(pc))[0].tasks[0].level, 4);
  await applyFollowerAbility(pc, ability("improved-follower", true), { confirmed: true, upgrades: [{ id: slots()[0].id, newTask: { id: "repair", label: "Repair" } }] });
  await upgrade();
  assert.equal(automaton.system.level, 5); assert.deepEqual((await followerDisplay(pc))[0].tasks.map(task => task.level), [5, 3]);
  pc.system.tier = 4; await synchronizeFollower(pc, slots()[0].id);
  assert.equal(automaton.system.level, 6); assert.deepEqual((await followerDisplay(pc))[0].tasks.map(task => task.level), [6, 4]);
  const replacement = npc("replacement"); await replaceFollower(pc, slots()[0].id, replacement, { confirmed: true });
  assert.deepEqual((await followerDisplay(pc))[0].tasks.map(task => task.level), [6, 4]);
});

test("generic follower improvements accept other source-bound families without reclassifying the original companion", async () => {
  const beast = npc("beast");
  await applyFollowerAbility(pc, ability("beast-companion", true), { confirmed: true, followers: [choice(beast)] });
  assert.equal(await applyFollowerAbility(pc, ability("expert-follower", true), { confirmed: true, variant: "upgrade",
    followers: [choice(npc("fresh"))], upgrades: [{ id: slots()[0].id }] }), true);
  assert.equal(beast.system.level, 3); assert.equal(slots()[0].sourceAbility.family, "beast");
});
