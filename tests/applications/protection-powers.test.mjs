import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { activateProtection, resumeProtection, abandonProtection, endProtection, recordNpcProtectionRecovery } from "../../module/applications/protection-power-service.mjs";
import { liveProtections, protectionWoundReduction, protectionNpcReduction, protectionBlockPlan } from "../../module/applications/protection-power-read.mjs";
import { protectionRecoveryUpdates } from "../../module/rules/protection-powers.mjs";
import { rollDefense } from "../../module/applications/task-service.mjs";
import { applyDamage, applyNpcDamage } from "../../module/applications/damage-service.mjs";
import { applyDefenseConsequences, reconcileDefenseConsequences } from "../../module/applications/defense-consequence-service.mjs";
import { applyAttackConsequences, reconcileAttackConsequences } from "../../module/applications/attack-consequence-service.mjs";
import { declareEnvironmentalExposure, resolveEnvironmentalExposure } from "../../module/applications/environment-service.mjs";
let pc, npc, friend, docs, next, die, rolls, messages;
function actor(uuid, type = "pc") {
  const doc = { uuid, id: uuid.split(".").at(-1), name: uuid, type, isOwner: true, flags: {}, items: new Map(), statuses: new Set(),
    system: type === "npc" ? { level: 4, armor: 2, health: { value: 20, max: 20 } } : { tier: 2, effort: 4, xp: 5, customStats: [],
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 20, max: 20 }, edge: 1 }])),
      armor: { blockEase: 1, dodgeHinder: 1, speedTaskHinder: 0 },
      wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  docs.set(uuid, doc); return doc;
}
function ability(key) { const id = `item${++next}`; pc.items.set(id, { id, type: "ability", name: key, system: { key, action: "action" } }); return id; }
const use = () => Object.values(pc.flags.cypher.protectionUses).at(-1);
const elemental = (options = {}) => activateProtection(pc, ability("elemental-protection"), { confirmed: true, inRange: true, energy: "fire", ...options });
beforeEach(() => {
  next = 0; die = 10; rolls = 0; messages = []; docs = new Map();
  pc = actor("Actor.pc"); friend = actor("Actor.friend"); npc = actor("Scene.s.Token.t.Actor.npc", "npc");
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, time: { worldTime: 0 }, i18n: { localize: key => key, format: key => key } };
  globalThis.foundry = { utils: { randomID: () => `id${++next}`, escapeHTML: value => value } };
  globalThis.fromUuid = async uuid => docs.get(uuid); globalThis.fromUuidSync = uuid => docs.get(uuid);
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => messages.push(message) };
  globalThis.Roll = class { async evaluate() { this.total = die; rolls++; return this; } async toMessage(message) { messages.push(message); return message; } };
});

test("Mage Armor changes only a selected Block to Intellect and grows at tier three; Debris eases Block but not Dodge", async () => {
  const mage = ability("mage-armor"), debris = ability("armoring-debris");
  assert.equal(await activateProtection(pc, mage, { confirmed: true }), true);
  assert.equal(pc.system.stats.intellect.pool.value, 20);
  assert.equal((await rollDefense(pc, "block", { mageArmor: true, difficulty: 5, applyIncomingWound: false })).stat, "intellect");
  assert.equal(messages.at(-1).flags.cypher.effectiveDifficulty, 3);
  assert.equal((await rollDefense(pc, "block", { difficulty: 5, applyIncomingWound: false })).stat, "might");
  assert.equal(messages.at(-1).flags.cypher.effectiveDifficulty, 4);
  pc.system.tier = 3;
  assert.equal(await activateProtection(pc, debris, { confirmed: true, debris: true }), true);
  await rollDefense(pc, "block", { mageArmor: true, difficulty: 5, applyIncomingWound: false });
  assert.equal(messages.at(-1).flags.cypher.effectiveDifficulty, 1);
  await rollDefense(pc, "dodge", { difficulty: 5, applyIncomingWound: false });
  assert.equal(messages.at(-1).flags.cypher.effectiveDifficulty, 6);
  assert.equal(pc.system.stats.intellect.pool.value, 16);
  applyDocumentUpdate(pc, protectionRecoveryUpdates(pc.flags.cypher, "tenMinutes"));
  assert.equal(protectionBlockPlan(pc, true).ease, 2);
  applyDocumentUpdate(pc, protectionRecoveryUpdates(pc.flags.cypher, "tenHours"));
  assert.equal(await rollDefense(pc, "block", { mageArmor: true }), null);
});

test("Elemental Protection pays dedicated Effort and Edge once and expires independently on actual recipients", async () => {
  assert.equal(await elemental({ effort: 2, targetUuids: [friend.uuid, npc.uuid] }), true);
  assert.equal(pc.system.stats.intellect.pool.value, 12); assert.equal(protectionNpcReduction(npc, "fire"), 9);
  await applyNpcDamage(npc, 14, { incomingEnergy: "fire" }); assert.equal(npc.system.health.value, 17);
  await applyNpcDamage(npc, 14, { ignoreArmor: true, incomingEnergy: "fire" }); assert.equal(npc.system.health.value, 12);
  applyDocumentUpdate(pc, protectionRecoveryUpdates(pc.flags.cypher, "hour"));
  assert.equal(protectionWoundReduction(pc, "fire"), 0); assert.equal(protectionWoundReduction(friend, "fire"), 3);
  assert.equal(await recordNpcProtectionRecovery(npc, { confirmed: true }), true);
  assert.equal(npc.system.health.value, 12); assert.equal(protectionNpcReduction(npc, "fire"), 0);
  assert.equal(protectionWoundReduction(friend, "fire"), 3);
});

test("identical bonuses deduplicate while distinct reduction magnitudes combine; energy is explicitly matched", async () => {
  await elemental(); await elemental();
  assert.equal(protectionWoundReduction(pc, "fire"), 1); assert.equal(protectionWoundReduction(pc, "cold"), 0);
  await elemental({ effort: 1 });
  assert.equal(protectionWoundReduction(pc, "fire"), 3);
  assert.equal(protectionWoundReduction(pc, "", ["heat"]), 3);
});

test("rejected fiction, resources, allocations and permissions spend nothing", async () => {
  const debris = ability("armoring-debris");
  assert.equal(await activateProtection(pc, debris, { confirmed: true }), false);
  npc.isOwner = false; assert.equal(await elemental({ targetUuids: [npc.uuid] }), false);
  assert.equal(await elemental({ effort: 3 }), false);
  pc.system.stats.intellect.pool.value = 0; assert.equal(await elemental(), false);
  assert.deepEqual(pc.flags, {});
});

test("uncertain recipient acknowledgement resumes after reload/source removal without another payment or renewed expiry", async () => {
  const update = npc.update;
  npc.update = async changes => { await update.call(npc, changes); throw Error("lost protection response"); };
  await assert.rejects(elemental({ targetUuids: [friend.uuid, npc.uuid] }), /lost protection/);
  assert.equal(liveProtections(friend).length, 0);
  const saved = use(); pc.flags = structuredClone(pc.flags); pc.items.clear(); npc.update = update;
  await recordNpcProtectionRecovery(npc, { confirmed: true });
  assert.equal(await resumeProtection(pc, saved.id), true);
  assert.equal(pc.system.stats.intellect.pool.value, 17);
  assert.equal(protectionWoundReduction(friend, "fire"), 1); assert.equal(protectionNpcReduction(npc, "fire"), 0);
});

test("abandoning paid partial work disables its receipts and permits a new cast without a refund", async () => {
  const update = npc.update; npc.update = async () => { throw Error("recipient rejected"); };
  await assert.rejects(elemental({ targetUuids: [npc.uuid] }), /recipient rejected/);
  assert.equal(await abandonProtection(pc, use().id), true);
  assert.equal(protectionWoundReduction(pc, "fire"), 0); assert.equal(pc.system.stats.intellect.pool.value, 17);
  npc.update = update; assert.equal(await elemental(), true);
});

test("defense corrections retain original energy protection after expiry and preserve unrelated wounds", async () => {
  await elemental();
  const result = await applyDefenseConsequences(pc, { defenseType: "block", success: false, applyIncomingWound: true,
    incomingSeverity: "major", incomingWounds: 1, incomingEnergy: "fire", usingShield: false });
  assert.equal(pc.system.wounds.moderate.current, 1);
  pc.system.wounds.minor.current = 1; await endProtection(pc, use().id);
  await reconcileDefenseConsequences(pc, { ...result, defenseType: "block", incomingSeverity: "major", incomingWounds: 1,
    applyIncomingWound: true, incomingEnergy: "fire" }, { success: true }, async () => {}, null);
  assert.equal(pc.system.wounds.moderate.current, 0); assert.equal(pc.system.wounds.minor.current, 2);
});

test("NPC attack corrections keep the original numerical protection despite later expiry and unrelated damage", async () => {
  await elemental({ targetUuids: [npc.uuid] });
  const attack = await applyAttackConsequences(npc, { success: false, totalDamage: 10, incomingEnergy: "fire", armorBypass: 0, weaponTargetEffects: [], weaponSource: {} });
  await recordNpcProtectionRecovery(npc, { confirmed: true }); npc.system.health.value -= 2;
  await reconcileAttackConsequences(npc, attack, { success: true, totalDamage: 10 }, async () => {});
  assert.equal(npc.system.health.value, 13);
});

test("energy protection changes only overflow wounds, not the initial Pool hit", async () => {
  await elemental(); pc.system.stats.speed.pool.value = 0;
  await applyDamage(pc, 6, { stat: "speed", incomingEnergy: "fire" });
  assert.equal(pc.system.wounds.minor.current, 1); assert.equal(pc.system.wounds.moderate.current, 0);
});

test("a fully protected environmental wound bypasses defense dice and paid Effort without bypassing exposure bookkeeping", async () => {
  await elemental({ effort: 2 });
  const entry = await declareEnvironmentalExposure(pc, { name: "Typed fire", mode: "defense", stat: "might", difficulty: 5,
    severity: "major", incomingEnergy: "fire" });
  const result = await resolveEnvironmentalExposure(pc, entry.id, { expectedSequence: 0, effortLevels: 2 });
  assert.equal(result.protected, true); assert.equal(rolls, 0);
  assert.equal(pc.system.stats.might.pool.value, 20);
  assert.equal(Object.values(pc.system.wounds).reduce((sum, track) => sum + track.current, 0), 0);
});

test("a chosen shield still absorbs the original wound rather than its owner's protected residual", async () => {
  await elemental({ effort: 2 });
  const shield = { id: "shield", type: "shield", name: "Shield", actor: pc, system: { equipped: true, wounds: {
    minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 1 }
  } }, async update(changes) { applyDocumentUpdate(this, changes); } };
  pc.items.set(shield.id, shield);
  await applyDefenseConsequences(pc, { defenseType: "block", success: true, applyIncomingWound: true,
    incomingSeverity: "major", incomingWounds: 1, incomingEnergy: "fire", usingShield: true, shieldItem: shield });
  assert.equal(shield.system.wounds.major.current, 1); assert.equal(shield.system.equipped, false);
  assert.equal(pc.system.wounds.major.current, 0);
});
