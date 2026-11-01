import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { summonTemporaryFollowers, resumeTemporarySummon, dismissTemporaryFollower, abandonTemporarySummon } from "../../module/applications/temporary-follower-service.mjs";
import { recompileTemporaryFollower, finishTemporaryReboot } from "../../module/applications/temporary-machine-service.mjs";
import { temporaryFollowers, temporaryEquipmentUsable } from "../../module/applications/temporary-follower-read.mjs";
import { temporaryRecoveryUpdates } from "../../module/rules/temporary-followers.mjs";
import { followerTaskPlan, followerCanAct } from "../../module/applications/follower-service.mjs";
import { applyAttackConsequences, reconcileAttackConsequences } from "../../module/applications/attack-consequence-service.mjs";
let pc, docs, next, die, messages;
function doc(uuid, type) {
  const actor = { uuid, id: uuid.split(".").at(-1), type, name: uuid, isOwner: true, system: {}, flags: {}, statuses: new Set(), items: new Map(),
    async update(changes) { applyDocumentUpdate(this, changes); },
    async createEmbeddedDocuments(_type, sources) { return sources.map(source => {
      const item = { ...structuredClone(source), id: `gear${++next}`, actor: this, async update(changes) { applyDocumentUpdate(this, changes); } };
      this.items.set(item.id, item); return item;
    }); } };
  docs.set(uuid, actor); return actor;
}
function ability(key, identity) {
  const id = `ability${++next}`; pc.items.set(id, { id, type: "ability", name: key, system: { key, action: key === "recompile-machine" ? "lastAction" : "action" },
    flags: { cypherFoundry: { crd: { logicalId: identity } } } }); return id;
}
function npc(id, level = 1, health = 6) { const actor = doc(id, "npc"); actor.system = { level, health: { value: health, max: 6 }, armor: 0 }; return actor; }
const options = npc => ({ confirmed: true, eligible: true, inRange: true, targets: [{ npcUuid: npc.uuid }] });
beforeEach(() => {
  next = 0; die = 10; messages = []; docs = new Map(); pc = doc("Actor.pc", "pc");
  pc.system = { tier: 6, effort: 6, xp: 5, customStats: [], armor: { speedTaskHinder: 0 },
    stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 50, max: 50 }, edge: 1 }])),
    wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) };
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, time: { worldTime: 0 }, i18n: { localize: key => key, format: key => key } };
  globalThis.foundry = { utils: { randomID: () => `id${++next}`, escapeHTML: value => value } };
  globalThis.fromUuid = async uuid => docs.get(uuid); globalThis.fromUuidSync = uuid => docs.get(uuid);
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => messages.push(message) };
  globalThis.Roll = class { async evaluate() { this.total = die; return this; } async toMessage(message) { messages.push(message); return message; } };
});
test("genre Basic preserves corpse Health, rejects destroyed bodies and replaces its prior animated corpse", async () => {
  const item = ability("basic-necromancy", "ability.basic-necromancy-d68c55e38e39");
  const first = npc("Actor.body", 1, 2), second = npc("Scene.scene.Token.token.Actor.corpse");
  assert.equal(await summonTemporaryFollowers(pc, item, options(first)), true);
  assert.equal(first.system.health.value, 2); assert.equal(pc.system.stats.intellect.pool.value, 48);
  assert.equal((await followerTaskPlan(pc)).assets, 1);
  assert.equal(await summonTemporaryFollowers(pc, item, options(second)), true);
  assert.equal(await followerCanAct(first), false);
  assert.equal((await followerTaskPlan(pc)).assets, 1);
  applyDocumentUpdate(pc, temporaryRecoveryUpdates(pc.flags.cypher, "hour"));
  assert.equal((await followerTaskPlan(pc)).assets, 0);
  first.system.health.value = 0;
  assert.equal(await summonTemporaryFollowers(pc, item, { ...options(first), targets: [{ npcUuid: first.uuid, repaired: true }] }), false);
});
test("focus bodies retain damage; confirmed repair revives a destroyed body at full Health", async () => {
  const item = ability("basic-necromancy", "ability.basic-necromancy-455f4fa10b45"), body = npc("Actor.body", 1, 0);
  assert.equal(await summonTemporaryFollowers(pc, item, options(body)), false);
  assert.equal(await summonTemporaryFollowers(pc, item, { ...options(body), targets: [{ npcUuid: body.uuid, repaired: true }] }), true);
  assert.equal(body.system.health.value, 6);
  applyDocumentUpdate(pc, temporaryRecoveryUpdates(pc.flags.cypher, "hour")); body.system.health.value = 3;
  assert.equal(await summonTemporaryFollowers(pc, item, options(body)), true);
  assert.equal(body.system.health.value, 3);
});
test("Improved Necromancy batches pay once with Edge and pending NPC writes resume without healing intervening damage", async () => {
  ability("improved-necromancy");
  const item = ability("basic-necromancy", "ability.basic-necromancy-455f4fa10b45"), a = npc("Actor.a"), b = npc("Actor.b"), update = b.update;
  b.update = async function(changes) { await update.call(this, changes); throw Error("lost NPC response"); };
  await assert.rejects(summonTemporaryFollowers(pc, item, { confirmed: true, eligible: true, inRange: true, targets: [{ npcUuid: a.uuid }, { npcUuid: b.uuid }] }), /lost NPC response/);
  assert.equal(pc.system.stats.intellect.pool.value, 47);
  b.update = update; b.system.health.value = 4; pc.flags = structuredClone(pc.flags);
  const use = Object.values(pc.flags.cypher.temporaryUses)[0];
  assert.equal(await resumeTemporarySummon(pc, use.id), true);
  assert.equal(b.system.health.value, 4); assert.equal(pc.system.stats.intellect.pool.value, 47);
});
test("Duplicate spends one combined Effort cost, excludes cyphers/artifacts and retains acquired loot on dismissal", async () => {
  const item = ability("duplicate"), a = npc("Actor.a", 2), b = npc("Actor.b", 3);
  pc.items.set("sword", { id: "sword", name: "Sword", type: "attack", system: { damage: 4 } });
  pc.items.set("cypher", { id: "cypher", type: "cypher", system: {} });
  pc.items.set("artifact", { id: "artifact", type: "artifact", system: {} });
  assert.equal(await summonTemporaryFollowers(pc, item, { confirmed: true, eligible: true, inRange: true,
    targets: [{ npcUuid: a.uuid }, { npcUuid: b.uuid }], duplicateEffort: 1, levelEffort: [0, 1] }), true);
  assert.equal(pc.system.stats.might.pool.value, 44);
  assert.equal(a.items.size, 1); assert.equal(b.items.size, 1);
  const copy = [...a.items.values()][0]; assert.equal(temporaryEquipmentUsable(copy), true);
  a.items.set("loot", { id: "loot", type: "equipment", name: "Acquired later", system: {} });
  const record = temporaryFollowers(pc).find(record => record.npcUuid === a.uuid);
  assert.equal(await dismissTemporaryFollower(pc, record.id), true);
  assert.equal(temporaryEquipmentUsable(copy), false); assert.equal(a.items.has("loot"), true);
});
test("an attack killing a Duplicate adds backlash once; its correction restores only attributed wounds and copies", async () => {
  const item = ability("duplicate"), copy = npc("Actor.copy", 2);
  await summonTemporaryFollowers(pc, item, options(copy));
  const attack = await applyAttackConsequences(copy, { success: true, totalDamage: 8, armorBypass: 0, weaponTargetEffects: [], weaponSource: {} });
  assert.equal(pc.system.wounds.moderate.current, 1); assert.equal(copy.system.health.value, 0);
  pc.system.wounds.minor.current = 1;
  const corrected = await reconcileAttackConsequences(copy, attack, { success: false, totalDamage: 0 }, async () => {});
  assert.equal(corrected.attackConsequences.state, "applied");
  assert.equal(copy.system.health.value, 6); assert.equal(pc.system.wounds.moderate.current, 0); assert.equal(pc.system.wounds.minor.current, 1);
});
test("Recompile companion uses a paid non-damaging Intellect attack and a confirmed reboot before granting help", async () => {
  const item = ability("recompile-machine"), machine = npc("Actor.machine", 3);
  const result = await recompileTemporaryFollower(pc, item, { npcUuid: machine.uuid, confirmed: true, machine: true, inRange: true, rebootRounds: 3 });
  assert.equal(result.success, true); assert.equal(machine.system.health.value, 6); assert.equal(pc.system.stats.intellect.pool.value, 43);
  const record = temporaryFollowers(pc)[0];
  assert.equal(await followerCanAct(machine), false); assert.equal((await followerTaskPlan(pc)).assets, 0);
  assert.equal(await finishTemporaryReboot(pc, record.id, { confirmed: true, elapsedRounds: 2 }), false);
  assert.equal(await finishTemporaryReboot(pc, record.id, { confirmed: true, elapsedRounds: 3 }), true);
  assert.equal((await followerTaskPlan(pc)).assets, 1);
  game.time.worldTime = 999999;
  assert.equal((await followerTaskPlan(pc)).assets, 1);
  applyDocumentUpdate(pc, temporaryRecoveryUpdates(pc.flags.cypher, "tenHours"));
  assert.equal((await followerTaskPlan(pc)).assets, 0); assert.equal(await followerCanAct(machine), true);
});
test("invalid sources, missing declarations, unauthorized NPCs and insufficient Pools do not spend", async () => {
  const item = ability("duplicate"), copy = npc("Actor.copy", 2);
  pc.system.stats.might.pool.value = 0;
  assert.equal(await summonTemporaryFollowers(pc, item, options(copy)), false);
  assert.equal(pc.flags.cypher?.temporaryFollowers, undefined);
  pc.system.stats.might.pool.value = 50; copy.isOwner = false;
  assert.equal(await summonTemporaryFollowers(pc, item, options(copy)), false);
  copy.isOwner = true; game.user.isGM = false;
  assert.equal(await summonTemporaryFollowers(pc, item, options(copy)), false);
  assert.equal(pc.system.stats.might.pool.value, 50);
});

test("insufficient Recompile costs reject without creating a planned companion", async () => {
  const item = ability("recompile-machine"), machine = npc("Actor.machine", 3);
  pc.system.stats.intellect.pool.value = 0;
  const before = JSON.stringify(pc);
  assert.equal(await recompileTemporaryFollower(pc, item, { npcUuid: machine.uuid, confirmed: true, machine: true, inRange: true, rebootRounds: 3 }), null);
  assert.equal(JSON.stringify(pc), before); assert.equal(machine.flags.cypher?.temporaryFollower, undefined);
});

test("a lost copy-creation acknowledgement resumes once, with no active half-created duplicate or repeated payment", async () => {
  const item = ability("duplicate"), copy = npc("Actor.copy", 2), create = copy.createEmbeddedDocuments;
  pc.items.set("sword", { id: "sword", type: "attack", name: "Sword", system: { damage: 4 } });
  copy.createEmbeddedDocuments = async function (...args) { await create.apply(this, args); throw Error("lost Item response"); };
  await assert.rejects(summonTemporaryFollowers(pc, item, options(copy)), /lost Item response/);
  assert.equal((await followerTaskPlan(pc)).assets, 0);
  assert.equal(temporaryEquipmentUsable([...copy.items.values()][0]), false);
  copy.createEmbeddedDocuments = create;
  const use = Object.values(pc.flags.cypher.temporaryUses)[0];
  assert.equal(await resumeTemporarySummon(pc, use.id), true);
  assert.equal(copy.items.size, 1); assert.equal(pc.system.stats.might.pool.value, 49);
});

test("abandoning a partial summon retains its cost and disables copies without blocking a new invocation", async () => {
  const item = ability("duplicate"), copy = npc("Actor.copy", 2), create = copy.createEmbeddedDocuments;
  pc.items.set("sword", { id: "sword", type: "attack", name: "Sword", system: { damage: 4 } });
  copy.createEmbeddedDocuments = async function (...args) { await create.apply(this, args); throw Error("lost Item response"); };
  await assert.rejects(summonTemporaryFollowers(pc, item, options(copy)), /lost Item response/);
  const use = Object.values(pc.flags.cypher.temporaryUses)[0];
  assert.equal(await abandonTemporarySummon(pc, use.id), true);
  assert.equal(await resumeTemporarySummon(pc, use.id), false);
  assert.equal(pc.system.stats.might.pool.value, 49);
  assert.equal(temporaryEquipmentUsable([...copy.items.values()][0]), false);
  assert.equal(await summonTemporaryFollowers(pc, item, options(npc("Actor.fresh", 2))), true);
  assert.equal(pc.system.stats.might.pool.value, 48);
});

test("Superheroics applies the existing raised Effort score to Duplicate's dedicated allocations", async () => {
  const item = ability("duplicate"), a = npc("Actor.a", 2), b = npc("Actor.b", 3);
  pc.system.effort = 1;
  const request = { confirmed: true, inRange: true, eligible: true, targets: [{ npcUuid: a.uuid }, { npcUuid: b.uuid }], duplicateEffort: 1, levelEffort: [0, 1] };
  assert.equal(await summonTemporaryFollowers(pc, item, request), false);
  ability("superheroics"); pc.flags.cypher = { superheroicsStat: "might" }; pc.system.rank = 1;
  assert.equal(await summonTemporaryFollowers(pc, item, request), true);
  assert.equal(pc.system.stats.might.pool.value, 44);
});

test("healing after backlash makes an attack correction request manual instead of reviving with an unattributable wound", async () => {
  const item = ability("duplicate"), copy = npc("Actor.copy", 2);
  await summonTemporaryFollowers(pc, item, options(copy));
  const attack = await applyAttackConsequences(copy, { success: true, totalDamage: 8, armorBypass: 0, weaponTargetEffects: [], weaponSource: {} });
  pc.system.wounds.moderate.current = 0; pc.flags.cypher.defenseRevisions = { wound_moderate: 1 };
  const correction = await reconcileAttackConsequences(copy, attack, { success: false, totalDamage: 0 }, async () => {});
  assert.equal(correction.attackConsequences.state, "manual"); assert.equal(copy.system.health.value, 0);
  assert.equal(pc.system.wounds.moderate.current, 0);
});
