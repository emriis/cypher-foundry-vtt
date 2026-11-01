import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { sootheBeast, maintainCalm, endCalm, resumeCalm, lightFire, finishLighting,
  bindTeamUp, inviteTeamUp, configureTeamUp, finishTeamUpBinding } from "../../module/applications/command-power-service.mjs";
import { hasActiveCalm, teamUpRecords, stampTeamUpInjury } from "../../module/applications/command-power-read.mjs";
import { commandRecoveryUpdates } from "../../module/rules/command-powers.mjs";
import { followerTaskPlan, followerCanAct, restoreFollowerAvailability } from "../../module/applications/follower-service.mjs";
import { roundActionContext, consumeRoundAction } from "../../module/applications/round-action-service.mjs";
import { createRoundFlow } from "../../module/rules/round-flow.mjs";
import { commandRoundPlans, markCommandSlots } from "../../module/applications/command-round-service.mjs";
import { applyCommandEffect } from "../../module/applications/command-effect-service.mjs";
import { rollTask } from "../../module/applications/task-service.mjs";
import { createProject, approveProject, completeProject } from "../../module/applications/project-service.mjs";
import { applyAttackConsequences, reconcileAttackConsequences } from "../../module/applications/attack-consequence-service.mjs";
let pc, npc, docs, next, die, messages;
function doc(uuid, type) {
  const actor = { uuid, id: uuid.split(".").at(-1), name: uuid, type, isOwner: true, system: {}, flags: {}, statuses: new Set(), items: new Map(),
    async update(changes) { applyDocumentUpdate(this, changes); } };
  docs.set(uuid, actor); return actor;
}
function ability(key) { const id = `item${++next}`; pc.items.set(id, { id, type: "ability", system: { key, action: key === "lighting-a-fire-under-them" ? "lastAction" : "action" } }); return id; }
const sootheOptions = () => ({ npcUuid: npc.uuid, confirmed: true, beast: true, inRange: true, seesYou: true, speaking: true });
const bindOptions = () => ({ npcUuid: npc.uuid, originId: "ability.duplicate", adaptation: "GM-defined NPC double", confirmed: true, taskLevels: [{ id: "charm", label: "Charm", level: 5 }] });
beforeEach(() => {
  next = 0; die = 10; docs = new Map(); messages = [];
  pc = doc("Actor.pc", "pc"); npc = doc("Scene.scene.Token.token.Actor.npc", "npc");
  pc.system = { tier: 2, effort: 4, xp: 5, customStats: [], armor: { speedTaskHinder: 0 },
    stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 20, max: 20 }, edge: 1 }])),
    wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) };
  npc.system = { level: 2, armor: 1, health: { value: 5, max: 6 } };
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, time: { worldTime: 0 }, i18n: { localize: key => key, format: key => key } };
  globalThis.foundry = { utils: { randomID: () => `id${++next}`, escapeHTML: value => value } };
  globalThis.fromUuid = async uuid => docs.get(uuid); globalThis.fromUuidSync = uuid => docs.get(uuid);
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => messages.push(message) };
  globalThis.Roll = class { async evaluate() { this.total = die; return this; } async toMessage(message) { messages.push(message); return message; } };
});

test("Soothe charges its non-damaging attack, survives reload and expires on the source recovery", async () => {
  const item = ability("soothe-the-savage"); die = 17;
  assert.equal((await sootheBeast(pc, item, sootheOptions())).success, true);
  assert.equal(pc.system.stats.intellect.pool.value, 19); assert.equal(npc.system.health.value, 5);
  pc.flags = structuredClone(pc.flags); assert.equal(hasActiveCalm(pc, npc), true);
  applyDocumentUpdate(pc, commandRecoveryUpdates(pc.flags.cypher, "tenMinutes"));
  assert.equal(hasActiveCalm(pc, npc), false);
});
test("rejected declarations, unowned targets and insufficient Pools do not charge or create calm", async () => {
  const item = ability("soothe-the-savage");
  assert.equal(await sootheBeast(pc, item, { ...sootheOptions(), speaking: false }), null);
  npc.isOwner = false; assert.equal(await sootheBeast(pc, item, sootheOptions()), null);
  npc.isOwner = true; pc.system.stats.intellect.pool.value = 0;
  assert.equal(await sootheBeast(pc, item, sootheOptions()), null); assert.deepEqual(pc.flags, {});
});
test("a successful partially applied calm resumes once without charging; a failed attack cannot resume", async () => {
  const item = ability("soothe-the-savage"), update = npc.update;
  npc.update = async changes => { await update.call(npc, changes); throw Error("lost calm response"); };
  await assert.rejects(sootheBeast(pc, item, sootheOptions()), /lost calm/);
  const id = Object.keys(pc.flags.cypher.commandCalms)[0]; npc.update = update;
  assert.equal(await resumeCalm(pc, id), true); assert.equal(pc.system.stats.intellect.pool.value, 19);
  await endCalm(pc, id); die = 2;
  await sootheBeast(pc, item, sootheOptions());
  const failed = Object.values(pc.flags.cypher.commandCalms).find(record => record.state === "awaiting");
  assert.equal(await resumeCalm(pc, failed.id), false); assert.equal(hasActiveCalm(pc, npc), false);
});
test("maintaining calm costs an action without another Pool charge and cannot bridge a missed combat turn", async () => {
  const item = ability("soothe-the-savage"); await sootheBeast(pc, item, sootheOptions());
  const id = Object.keys(pc.flags.cypher.commandCalms)[0], member = { id: "pc", actor: pc };
  game.combat = { id: "fight", started: true, combatants: { contents: [member] }, flags: { cypher: { turnRevisions: { pc: 1 } } } };
  assert.equal(await maintainCalm(pc, id, { confirmed: true, speaking: true, seesYou: true, inRange: true }), true);
  applyDocumentUpdate(pc, commandRecoveryUpdates(pc.flags.cypher, "hour"));
  assert.equal(hasActiveCalm(pc, npc), true); assert.equal(pc.system.stats.intellect.pool.value, 19);
  game.combat.flags.cypher.turnRevisions.pc = 3;
  assert.equal(hasActiveCalm(pc, npc), false);
  assert.equal(await maintainCalm(pc, id, { confirmed: true, speaking: true, seesYou: true, inRange: true }), false);
});
test("Lighting resumes an uncertain target write, renews only on recovery and is consumed by the next action", async () => {
  const item = ability("lighting-a-fire-under-them"), update = npc.update;
  npc.update = async changes => { await update.call(npc, changes); throw Error("lost command response"); };
  await assert.rejects(lightFire(pc, item, { targetUuid: npc.uuid, confirmed: true, ally: true, inRange: true }), /lost command/);
  npc.update = update; pc.flags = structuredClone(pc.flags);
  assert.equal(await finishLighting(pc), true);
  assert.equal(await lightFire(pc, item, { targetUuid: pc.uuid, confirmed: true, ally: true, inRange: true }), false);
  await consumeRoundAction(roundActionContext(npc, { actionTiming: "lastAction" }));
  assert.equal(npc.flags.cypher.commandBoost.state, "consumed");
  applyDocumentUpdate(pc, commandRecoveryUpdates(pc.flags.cypher, "tenMinutes"));
  assert.equal(await lightFire(pc, item, { targetUuid: npc.uuid, confirmed: true, ally: true, inRange: true }), true);
});
test("managed command plans promote normal actions, normalize Last and do not grant extra primary actions", async () => {
  pc.flags.cypher = { commandBoost: { id: "boost", state: "active" } };
  const member = { id: "member", actor: pc }, combat = { id: "fight", started: true, round: 1, combatants: new Map([[member.id, member]]), flags: {} };
  game.combat = combat;
  const plans = commandRoundPlans(combat, []); assert.equal(plans[0].mode, "first");
  assert.equal(commandRoundPlans(combat, [{ combatantId: member.id, mode: "last", confirmed: true }])[0].mode, "normal");
  const flow = markCommandSlots(combat, createRoundFlow([member.id], plans)); flow.cursor = 0;
  combat.flags.cypher = { roundFlow: flow };
  assert.equal(roundActionContext(pc, { actionTiming: "lastAction" }).kind, null);
  assert.equal(roundActionContext(pc, { actionTiming: "action" }).kind, "primary");
  await consumeRoundAction(roundActionContext(pc, { actionTiming: "action" }));
  assert.equal(roundActionContext(pc, { actionTiming: "action" }).kind, null);
  assert.deepEqual(commandRoundPlans(combat, []), [], "unboosted actors retain default preparation handling");
});

test("a stale Lighting resume cannot acknowledge a later command while its target lookup was pending", async () => {
  const item = ability("lighting-a-fire-under-them"), update = npc.update;
  npc.update = async changes => { await update.call(npc, changes); throw Error("lost command"); };
  await assert.rejects(lightFire(pc, item, { targetUuid: npc.uuid, confirmed: true, ally: true, inRange: true }), /lost command/);
  npc.update = update;
  let release;
  globalThis.fromUuid = () => new Promise(resolve => { release = resolve; });
  const stale = finishLighting(pc);
  while (!release) await Promise.resolve();
  pc.flags.cypher.lightingUse = { version: 1, id: "later", targetUuid: pc.uuid, state: "pending", revision: 1 };
  release(npc);
  assert.equal(await stale, false); assert.equal(pc.flags.cypher.lightingUse.state, "pending");
});
test("Team-Up binds a fixed-level ally with a declared power; each outing needs availability and charm", async () => {
  const item = ability("team-up-ally"); npc.system.level = 4;
  assert.equal(await bindTeamUp(pc, item, { ...bindOptions(), originId: "ability.team-up-ally" }), false);
  assert.equal(await bindTeamUp(pc, item, bindOptions()), true);
  const ally = teamUpRecords(pc)[0]; assert.equal((await followerTaskPlan(pc)).assets, 0);
  assert.equal(await inviteTeamUp(pc, ally.id, { confirmed: true, label: "Patrol" }), null);
  die = 2; await inviteTeamUp(pc, ally.id, { confirmed: true, available: true, label: "Patrol" });
  assert.equal((await followerTaskPlan(pc)).assets, 0);
  const failed = messages.at(-1).flags.cypher.ruleEffect;
  die = 10; await inviteTeamUp(pc, ally.id, { confirmed: true, available: true, label: "Patrol" });
  assert.equal((await followerTaskPlan(pc, [{ id: ally.id, taskId: "charm" }])).assets, 2);
  pc.system.tier = 6; assert.equal(npc.system.level, 4);
  await configureTeamUp(pc, ally.id, { mode: "independent" }); assert.equal(await followerCanAct(npc), true);
  await configureTeamUp(pc, ally.id, { endOuting: true });
  assert.equal(await followerCanAct(npc), false); assert.equal(await applyCommandEffect(npc, failed.effect), false);
});
test("Team-Up binding resumes after reload; injured allies require care and a fresh outing after restoration", async () => {
  const item = ability("team-up-ally"); npc.system.level = 4;
  const update = npc.update; npc.update = async changes => { await update.call(npc, changes); throw Error("lost binding"); };
  await assert.rejects(bindTeamUp(pc, item, bindOptions()), /lost binding/);
  npc.update = update; const ally = teamUpRecords(pc)[0];
  assert.equal(await finishTeamUpBinding(pc, ally.id), true);
  await inviteTeamUp(pc, ally.id, { confirmed: true, available: true, label: "Patrol" });
  const changes = { "system.health.value": 0 }; stampTeamUpInjury(npc, changes); await npc.update(changes);
  npc.system.health.value = 5;
  assert.equal((await followerTaskPlan(pc)).assets, 0);
  await restoreFollowerAvailability(pc, npc.uuid);
  assert.equal(npc.flags.cypher.teamUpAlly.injured, false); assert.equal((await followerTaskPlan(pc)).assets, 0);
});
test("macros cannot turn Soothe into a damaging free attack without its source-bound consequence", async () => {
  const item = ability("soothe-the-savage");
  assert.equal(await rollTask(pc, { stat: "intellect", isAttack: true, baseDamage: 4, activationCost: 2, abilitySource: { itemId: item } }), null);
  assert.equal(pc.system.stats.intellect.pool.value, 20);
});

test("Team-Up care rejects a generic one-week restoration and settles the declared longer care for two resource points", async () => {
  pc.system.resourcePoints = 5; npc.system.level = 4;
  await bindTeamUp(pc, ability("team-up-ally"), bindOptions());
  npc.system.health.value = 0; npc.flags.cypher.teamUpAlly.injured = true;
  const proposal = { label: "Care", kind: "restoreFollower", targetUuid: npc.uuid, followerConfirmed: true,
    durationSeconds: 604800, durationSource: "Team-Up Ally" };
  const rejected = await createProject(pc, proposal);
  assert.equal(await approveProject(pc, rejected, { confirmed: true }), false);
  assert.equal(pc.system.resourcePoints, 5);
  const id = await createProject(pc, { ...proposal, durationSeconds: 1814400, teamUpCareConfirmed: true });
  assert.equal(await approveProject(pc, id, { confirmed: true }), true);
  game.time.worldTime = 1814400;
  assert.equal(await completeProject(pc, id, { workConfirmed: true }), true);
  assert.equal(pc.system.resourcePoints, 3); assert.equal(npc.system.health.value, 6);
  assert.equal(npc.flags.cypher.teamUpAlly.injured, false);
});

test("an attributable attack correction also reverses the Team-Up injury requirement and preserves its outing", async () => {
  npc.system.level = 4; await bindTeamUp(pc, ability("team-up-ally"), bindOptions());
  const ally = teamUpRecords(pc)[0]; await inviteTeamUp(pc, ally.id, { confirmed: true, available: true, label: "Patrol" });
  const attack = await applyAttackConsequences(npc, { success: true, totalDamage: 9, armorBypass: 0, weaponTargetEffects: [], weaponSource: {} });
  assert.equal(npc.flags.cypher.teamUpAlly.injured, true); assert.equal((await followerTaskPlan(pc)).assets, 0);
  await reconcileAttackConsequences(npc, attack, { success: false, totalDamage: 0 }, async () => {});
  assert.equal(npc.system.health.value, 5); assert.equal(npc.flags.cypher.teamUpAlly.injured, false);
  assert.equal((await followerTaskPlan(pc)).assets, 1);
});
