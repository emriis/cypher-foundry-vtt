import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { activateAwesomePersonal, restoreAwesomePersonal } from "../../module/applications/awesome-personal-service.mjs";
import { createAwesomeBarrier, resumeAwesomeBarrier, containWithAwesomeBarrier, reconcileAwesomeCapture, releaseAwesomeContainment } from "../../module/applications/awesome-barrier-service.mjs";
import { awesomePersonalActive, awesomeBarrierObstructs, awesomeContainments } from "../../module/applications/awesome-field-read.mjs";
import { protectionBlockPlan } from "../../module/applications/protection-power-read.mjs";
import { activateProtection } from "../../module/applications/protection-power-service.mjs";
import { rollDefense, rollTask } from "../../module/applications/task-service.mjs";
import { reconcileDefenseConsequences } from "../../module/applications/defense-consequence-service.mjs";
import { damageObject, resetObject } from "../../module/applications/object-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
let pc, npc, friend, docs, next, die, rolls, messages;
function actor(uuid, type = "pc") {
  const doc = { uuid, id: uuid.split(".").at(-1), name: uuid, type, isOwner: true, flags: {}, items: new Map(), statuses: new Set(),
    system: type === "npc" ? { level: 4, armor: 2, health: { value: 20, max: 20 } } : { tier: 2, effort: 4, xp: 5, customStats: [],
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 20, max: 20 }, edge: 1 }])),
      armor: { blockEase: 1, dodgeHinder: 1, speedTaskHinder: 0 },
      wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  docs.set(uuid, doc); if (globalThis.game?.actors) game.actors.contents = [...docs.values()]; return doc;
}
function ability(key) { const id = `item${++next}`; pc.items.set(id, { id, type: "ability", name: key, system: { key, action: "action" } }); return id; }


beforeEach(() => {
  next = 0; die = 10; rolls = 0; messages = []; docs = new Map();
  globalThis.game = null;
  pc = actor("Actor.pc"); friend = actor("Actor.friend"); npc = actor("Scene.s.Token.t.Actor.npc", "npc");
  globalThis.game = { actors: { contents: [...docs.values()] }, messages: new Map(), user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, time: { worldTime: 0 }, i18n: { localize: key => key, format: key => key } };
  globalThis.foundry = { utils: { randomID: () => `id${++next}`, escapeHTML: value => value } };
  foundry.documents = { Actor: { create: async data => { const object = actor(`Actor.object${++next}`, "object"); Object.assign(object, data); return object; } } };
  foundry.documents.Actor.implementation = foundry.documents.Actor;
  globalThis.fromUuid = async uuid => docs.get(uuid); globalThis.fromUuidSync = uuid => docs.get(uuid);
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => messages.push(message) };
  globalThis.Roll = class { async evaluate() { this.total = die; rolls++; return this; } async toMessage(message) { messages.push(message); return message; } };
});

const personal = () => activateAwesomePersonal(pc, ability("awesome-force-field"), { confirmed: true });
const barrier = (options = {}) => createAwesomeBarrier(pc, ability("awesome-force-field"), { confirmed: true, inRange: true, location: "declared gate", ...options });
const fields = () => Object.values(pc.flags.cypher.awesomeBarriers);
const block = (options = {}) => rollDefense(pc, "block", { difficulty: 3, incomingSeverity: "major", awesomeField: true, chooseFieldShatter: async () => true, ...options });
function origin() {
  const message = messages.at(-1); message.id = `m${++next}`; message.isOwner = true;
  message.getFlag = (scope, key) => message.flags[scope]?.[key];
  message.update = async changes => applyDocumentUpdate(message, changes);
  game.messages.set(message.id, message); return message;
}

test("a personal field costs an action, cannot recast past shattering, and expires at a ten-minute recovery", async () => {
  assert.equal(await personal(), true); assert.equal(pc.system.stats.intellect.pool.value, 20);
  assert.equal(awesomePersonalActive(pc), true); assert.equal(await personal(), false);
  await block(); assert.equal(awesomePersonalActive(pc), false);
  assert.equal(await personal(), false); pc.flags = structuredClone(pc.flags);
  assert.equal(await restoreAwesomePersonal(pc, { confirmed: true }), true); assert.equal(awesomePersonalActive(pc), true);
  pc.flags.cypher.protectionRecoveries = { tenMinutes: 1 }; assert.equal(awesomePersonalActive(pc), false);
});

test("incapacitated owners and cancelled activation spend nothing", async () => {
  pc.statuses.add("unconscious"); assert.equal(await personal(), false); assert.deepEqual(pc.flags, {});
  pc.statuses.clear(); assert.equal(await activateAwesomePersonal(pc, ability("awesome-force-field")), false);
});

test("Intellect Block deduplicates identical easing and combines distinct bonuses", async () => {
  await personal(); await activateProtection(pc, ability("mage-armor"), { confirmed: true });
  assert.equal(protectionBlockPlan(pc, false, true).ease, 1);
  pc.system.tier = 3; assert.equal(protectionBlockPlan(pc, false, true).ease, 3);
  assert.equal(protectionBlockPlan(pc, true, true), null);
});

test("one residual wound is cancelled and the additional cost uses only remaining action Edge", async () => {
  await personal(); pc.system.stats.intellect.edge = 2;
  await block({ effortLevels: 1 });
  assert.equal(pc.system.stats.intellect.pool.value, 14); // 3 - 2, then 5 with Edge already used.
  assert.equal(pc.system.wounds.moderate.current, 0); assert.equal(messages.at(-1).flags.cypher.effortCost, 6);
  assert.equal(messages.at(-1).flags.cypher.awesomeBlock.shattered, true);
});

test("Might, declined shattering and an already cancelled minor wound never pay the additional cost", async () => {
  await personal(); let offered = 0;
  await block({ awesomeField: false, chooseFieldShatter: async () => { offered++; return true; } });
  assert.equal(offered, 0); assert.equal(pc.system.wounds.moderate.current, 1);
  await block({ chooseFieldShatter: async () => false }); assert.equal(pc.system.wounds.moderate.current, 2);
  await block({ incomingSeverity: "minor", chooseFieldShatter: async () => { offered++; return true; } });
  assert.equal(offered, 0); assert.equal(pc.system.stats.intellect.pool.value, 20);
  assert.equal(await block({ incomingWounds: 2 }), null);
});

test("a retained natural twenty negates the wound for zero cost and refunds initial Effort", async () => {
  await personal(); die = 20; await block({ effortLevels: 1 });
  assert.equal(pc.system.stats.intellect.pool.value, 20); assert.equal(pc.system.wounds.moderate.current, 0);
  assert.equal(messages.at(-1).flags.cypher.awesomeBlock.cost, 0);
});

test("a failed defense upgraded by a paid reroll cancels only its wound and keeps action spending", async () => {
  await personal(); die = 1; await block({ effortLevels: 1 }); const message = origin();
  pc.system.wounds.minor.current = 1; die = 10;
  await rerollMessage(pc, message, { chooseFieldShatter: async () => true });
  assert.equal(pc.system.wounds.major.current, 0); assert.equal(pc.system.wounds.minor.current, 1);
  assert.equal(pc.system.stats.intellect.pool.value, 13); assert.equal(pc.system.xp, 4);
});

test("lost wound attribution prevents both correction and a new shatter payment", async () => {
  await personal(); die = 1; await block(); const flags = messages.at(-1).flags.cypher;
  pc.system.wounds.major.current = 0; let prompted = false;
  const result = await reconcileDefenseConsequences(pc, flags, { success: true }, async () => {}, null, pc,
    { chooseFieldShatter: async () => { prompted = true; return true; } });
  assert.equal(result.defenseConsequences.state, "manual"); assert.equal(prompted, false); assert.equal(pc.system.stats.intellect.pool.value, 20);
});

test("a later twenty refunds the original shatter exactly once without restoring the field", async () => {
  await personal(); await block({ effortLevels: 1 }); const message = origin(); die = 20;
  await rerollMessage(pc, message); assert.equal(pc.system.stats.intellect.pool.value, 20);
  assert.equal(awesomePersonalActive(pc), false); pc.system.stats.intellect.pool.value = 18;
  await rerollMessage(pc, message); assert.equal(pc.system.stats.intellect.pool.value, 18);
});

test("a successful Block rerolled to twenty can newly shatter its attributable residual wound", async () => {
  await personal(); await block({ effortLevels: 1, chooseFieldShatter: async () => false });
  const message = origin(); pc.system.wounds.minor.current = 1; die = 20;
  await rerollMessage(pc, message, { chooseFieldShatter: async () => true });
  assert.equal(pc.system.wounds.moderate.current, 0); assert.equal(pc.system.wounds.minor.current, 1);
  assert.equal(pc.system.stats.intellect.pool.value, 20); assert.equal(awesomePersonalActive(pc), false);
});

test("barriers reserve increasing dedicated Effort while the personal field does not count", async () => {
  await personal(); await barrier(); await barrier(); await barrier();
  assert.deepEqual(fields().map(field => field.levels), [1, 2, 3]);
  assert.equal(pc.system.stats.intellect.pool.value, 8); // 2 + 4 + 6.
  const object = docs.get(fields()[0].objectUuid); assert.equal(object.system.physical, false); assert.equal(object.system.originalLevel, 6);
  await damageObject(object, 12); assert.equal(awesomeBarrierObstructs(object), false);
  await barrier(); assert.equal(fields().at(-1).levels, 3);
});

test("barrier validation rejects range, score, permissions and incompatible targets before spending", async () => {
  assert.equal(await barrier({ inRange: false }), null); assert.equal(await barrier({ targets: [npc.uuid] }), null);
  pc.system.effort = 0; assert.equal(await barrier(), null); assert.deepEqual(pc.flags, {});
  pc.system.effort = 4; game.user.isGM = false; assert.equal(await barrier(), null);
});

test("lost Object creation acknowledgement resumes the same damaged object without repaying or renewing expiry", async () => {
  const create = foundry.documents.Actor.implementation.create;
  foundry.documents.Actor.implementation.create = async data => { await create(data); throw Error("lost creation acknowledgement"); };
  await assert.rejects(barrier(), /lost creation/); const field = fields()[0], object = [...docs.values()].find(doc => doc.type === "object");
  object.system.levelDamage = 2; pc.flags = structuredClone(pc.flags); pc.items.clear(); foundry.documents.Actor.implementation.create = create;
  assert.equal(await resumeAwesomeBarrier(pc, field.id), true); assert.equal(fields()[0].objectUuid, object.uuid);
  assert.equal(pc.system.stats.intellect.pool.value, 18); assert.equal(object.system.levelDamage, 2);
  assert.equal([...docs.values()].filter(doc => doc.type === "object").length, 1);
});

test("nonphysical barrier damage breaks then destroys only on later blows; expiry forbids fresh damage and reset", async () => {
  await barrier(); const object = docs.get(fields()[0].objectUuid);
  await damageObject(object, 50); assert.equal(object.system.destructionDamage, 0); assert.equal(object.system.levelDamage, 6);
  await damageObject(object, 6); assert.equal(object.system.destructionDamage, 6);
  assert.equal(await resetObject(object, { confirmed: true }), false);
  pc.flags.cypher.protectionRecoveries = { tenMinutes: 1 }; const before = structuredClone(object.system);
  assert.equal(await damageObject(object, 50), false); assert.deepEqual(object.system, before);
});

test("the first trapping attack shares creation Effort and Edge, deals no damage and cannot be replayed", async () => {
  pc.system.stats.intellect.edge = 4; const id = await barrier({ shape: "cube", targets: [npc.uuid, friend.uuid] });
  assert.equal(id, null); // A PC is not silently resolved with an NPC attack contract.
  const second = actor("Scene.s.Token.second.Actor.npc", "npc");
  const fieldId = await barrier({ shape: "cube", targets: [npc.uuid, second.uuid] }), entry = fields()[0].targets[0];
  die = 10; await containWithAwesomeBarrier(pc, fieldId, entry.id, { confirmed: true, effortLevels: 1 });
  assert.equal(pc.system.stats.intellect.pool.value, 19); // creation 3 - Edge4, incremental 2 - remaining1.
  assert.equal(npc.system.health.value, 20); assert.equal(awesomeContainments(npc).length, 1);
  assert.equal(await containWithAwesomeBarrier(pc, fieldId, entry.id, { confirmed: true }), null);
  await containWithAwesomeBarrier(pc, fieldId, fields()[0].targets[1].id, { confirmed: true, effortLevels: 1 });
  assert.equal(pc.system.stats.intellect.pool.value, 19); // Later target gets its own attack's Edge.
  assert.equal(awesomeContainments(second).length, 1); assert.equal(second.system.health.value, 20);
  assert.equal(await releaseAwesomeContainment(npc, entry.id, { confirmed: true }), true); assert.equal(awesomeContainments(npc).length, 0);
});

test("creation levels still consume the Effort score on the first target", async () => {
  pc.system.effort = 1; const id = await barrier({ shape: "sphere", targets: [npc.uuid] }), entry = fields()[0].targets[0];
  assert.equal(await containWithAwesomeBarrier(pc, id, entry.id, { confirmed: true, effortLevels: 1 }), null);
  assert.equal(pc.system.stats.intellect.pool.value, 18); assert.equal(entry.state, "awaiting");
});

test("a capture reroll can succeed after reload and a twenty refunds creation only once", async () => {
  const id = await barrier({ shape: "sphere", targets: [npc.uuid] }), entry = fields()[0].targets[0]; die = 1;
  await containWithAwesomeBarrier(pc, id, entry.id, { confirmed: true }); const message = origin();
  assert.equal(awesomeContainments(npc).length, 0); pc.flags = structuredClone(pc.flags); die = 20;
  await rerollMessage(pc, message); assert.equal(pc.system.stats.intellect.pool.value, 20); assert.equal(awesomeContainments(npc).length, 1);
  pc.system.stats.intellect.pool.value = 18; await rerollMessage(pc, message); assert.equal(pc.system.stats.intellect.pool.value, 18);
});

test("an expired field never captures from an old successful reroll", async () => {
  const id = await barrier({ shape: "sphere", targets: [npc.uuid] }), entry = fields()[0].targets[0]; die = 1;
  await containWithAwesomeBarrier(pc, id, entry.id, { confirmed: true }); const message = origin();
  pc.flags.cypher.protectionRecoveries = { tenMinutes: 1 }; die = 10; await rerollMessage(pc, message);
  assert.equal(awesomeContainments(npc).length, 0); assert.equal(npc.system.health.value, 20);
});

test("an interrupted paid capture requires observed-result adjudication without rerolling or repayment", async () => {
  const id = await barrier({ shape: "sphere", targets: [npc.uuid] }), entry = fields()[0].targets[0];
  globalThis.Roll = class { async evaluate() { throw Error("lost roll"); } };
  await assert.rejects(containWithAwesomeBarrier(pc, id, entry.id, { confirmed: true, effortLevels: 1 }), /lost roll/);
  const pool = pc.system.stats.intellect.pool.value;
  assert.equal(await containWithAwesomeBarrier(pc, id, entry.id, { confirmed: true }), null);
  assert.equal(await reconcileAwesomeCapture(pc, id, entry.id, { confirmed: true, success: true, note: "GM observed success" }), true);
  assert.equal(pc.system.stats.intellect.pool.value, pool); assert.equal(awesomeContainments(npc).length, 1);
});

test("declared crossings are blocked before spending while attacking the barrier remains possible", async () => {
  await barrier(); const object = docs.get(fields()[0].objectUuid);
  assert.equal(await rollTask(pc, { stat: "might", effortLevels: 1, awesomeCrossing: object.uuid }), null);
  assert.equal(pc.system.stats.might.pool.value, 20);
  await damageObject(object, 12);
  assert.ok(await rollTask(pc, { stat: "might", effortLevels: 1, awesomeCrossing: object.uuid }));
});


test("shattering survives reload and initiative reordering until the actual next source turn", async () => {
  await personal();
  game.combat = { id: "c", round: 1, turn: 0, turns: [{ id: "owner", actor: pc }], flags: { cypher: { turnRevisions: { owner: 4 } } } };
  await block(); pc.flags = structuredClone(pc.flags);
  assert.equal(awesomePersonalActive(pc), false);
  game.combat.turn = 1; game.combat.round = 2; assert.equal(awesomePersonalActive(pc), false);
  assert.equal(await restoreAwesomePersonal(pc, { confirmed: true }), false);
  game.combat.flags.cypher.turnRevisions.owner = 5; assert.equal(awesomePersonalActive(pc), true);
});

test("a fresh twenty on the first capture refunds both creation and attack but never deals bonus damage", async () => {
  const id = await barrier({ shape: "sphere", targets: [npc.uuid] }), entry = fields()[0].targets[0]; die = 20;
  await containWithAwesomeBarrier(pc, id, entry.id, { confirmed: true, effortLevels: 1 });
  assert.equal(pc.system.stats.intellect.pool.value, 20); assert.equal(npc.system.health.value, 20);
  assert.equal(awesomeContainments(npc).length, 1); assert.equal(fields()[0].refunded, true);
});


test("zero-cost personal activation consumes a managed primary action; another activation cannot borrow it", async () => {
  const member = { id: "owner", actor: pc };
  game.combat = { id: "c", started: true, round: 1, combatants: new Map([[member.id, member]]),
    flags: { cypher: { roundFlow: { version: 1, revision: 1, round: 1, cursor: 0,
      queue: [{ id: "step", combatantId: "owner", phase: "normal", done: false }] } } } };
  assert.equal(await personal(), true); assert.equal(pc.flags.cypher.roundActionUsage.primary, true);
  assert.equal(await barrier(), null); assert.equal(pc.system.stats.intellect.pool.value, 20);
});
