import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { applyFollowerAbility } from "../../module/applications/follower-ability-service.mjs";
import { installCompanionUpgrade, activateCompanionUpgrade, resumeCompanionUpgrade, endCompanionUpgrade } from "../../module/applications/companion-upgrade-service.mjs";
import { effectiveCypherLimit, companionEquipmentUsable, automatonFlight } from "../../module/applications/companion-upgrade-read.mjs";
import { companionRecoveryUpdates } from "../../module/rules/companion-upgrades.mjs";
import { applyNpcDamage } from "../../module/applications/damage-service.mjs";
import { applyDefenseConsequences, reconcileDefenseConsequences } from "../../module/applications/defense-consequence-service.mjs";
import { applyAttackConsequences, reconcileAttackConsequences } from "../../module/applications/attack-consequence-service.mjs";
import { configureCompanion } from "../../module/applications/companion-power-service.mjs";
import { beastEyesVision } from "../../module/applications/companion-vision.mjs";
import { fireAutomatonTurret } from "../../module/applications/companion-turret-service.mjs";
import { consumeRoundAction } from "../../module/applications/round-action-service.mjs";
import { prepareAttackOptions } from "../../module/applications/item-service.mjs";
let pc, npc, docs, next, followerId;
function ability(key) { const id = `item${++next}`; pc.items.set(id, { id, type: "ability", name: key, system: { key }, parent: pc }); return id; }
function document(uuid, type) {
  return { uuid, type, isOwner: true, flags: {}, items: new Map(), system: {}, async update(changes) { applyDocumentUpdate(this, changes); },
    async createEmbeddedDocuments(_type, sources) {
      return sources.map(source => {
        const item = { ...source, id: `proxy${++next}`, actor: this, async update(changes) { applyDocumentUpdate(this, changes); } };
        this.items.set(item.id, item); return item;
      });
    } };
}
beforeEach(async () => {
  delete globalThis.canvas;
  next = 0; pc = document("Actor.pc", "pc"); npc = document("Scene.s.Token.t.Actor.npc", "npc");
  pc.system = { tier: 2, cypherLimit: 2, stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } };
  npc.system = { level: 2, health: { value: 6, max: 6 }, armor: 1 };
  docs = new Map([[pc.uuid, pc], [npc.uuid, npc]]);
  globalThis.fromUuid = async uuid => docs.get(uuid);
  globalThis.fromUuidSync = uuid => docs.get(uuid);
  globalThis.foundry = { utils: { randomID: () => `id${++next}` } };
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, time: { worldTime: 0 }, i18n: { localize: key => key } };
  await applyFollowerAbility(pc, ability("automaton-assistant"), { confirmed: true, followers: [{ npcUuid: npc.uuid, healthPerLevel: 3 }] });
  followerId = Object.keys(pc.flags.cypher.followers)[0];
});
async function install(key) {
  assert.equal(await installCompanionUpgrade(pc, ability(key), followerId, { confirmed: true }), true);
  return Object.values(pc.flags.cypher.companionUpgrades).find(binding => binding.key === key).id;
}
const effect = key => Object.values(pc.flags.cypher.companionEffects).find(entry => entry.key === key && entry.state === "active");

test("installation is free, activation pays each time with Edge and capacity expires without editing the saved limit", async () => {
  const id = await install("automaton-cypher-upgrade");
  assert.equal(pc.system.stats.intellect.pool.value, 20);
  assert.equal(await activateCompanionUpgrade(pc, id, { confirmed: false }), false);
  assert.equal(await activateCompanionUpgrade(pc, id, { confirmed: true }), true);
  assert.equal(pc.system.stats.intellect.pool.value, 18); assert.equal(effectiveCypherLimit(pc), 3);
  assert.equal(await activateCompanionUpgrade(pc, id, { confirmed: true }), false);
  assert.equal(pc.system.stats.intellect.pool.value, 18);
  game.time.worldTime = 86400;
  assert.equal(effectiveCypherLimit(pc), 2); assert.equal(pc.system.cypherLimit, 2);
  assert.equal(await activateCompanionUpgrade(pc, id, { confirmed: true }), true);
  assert.equal(pc.system.stats.intellect.pool.value, 16);
});

test("armor transformations reuse damage, exclude the other physical form and expire before cleanup", async () => {
  const light = await install("automaton-armor-upgrade"), heavy = await install("automaton-heavy-armor-upgrade");
  assert.equal(await activateCompanionUpgrade(pc, light, { confirmed: true, immediate: true }), true);
  const armor = [...pc.items.values()].find(item => item.type === "armor");
  assert.equal(armor.system.equipped, true); assert.equal(companionEquipmentUsable(armor), true);
  armor.system.blockEaseDamage = 2;
  assert.equal(await activateCompanionUpgrade(pc, heavy, { confirmed: true, immediate: true }), true);
  assert.equal([...pc.items.values()].filter(item => item.type === "armor").length, 1);
  assert.equal(armor.system.blockEaseDamage, 2); assert.equal(armor.system.category, "heavy");
  assert.equal(Object.values(pc.flags.cypher.companionEffects).filter(entry => entry.state === "active").length, 1);
  applyDocumentUpdate(pc, companionRecoveryUpdates(pc.flags.cypher, "hour"));
  assert.equal(companionEquipmentUsable(armor), false);
});

test("uncertain proxy creation resumes after reload without repaying or duplicating equipment", async () => {
  const id = await install("automaton-armor-upgrade"), create = pc.createEmbeddedDocuments;
  pc.createEmbeddedDocuments = async function (...args) { await create.apply(this, args); throw Error("lost response"); };
  await assert.rejects(activateCompanionUpgrade(pc, id, { confirmed: true, immediate: true }), /lost response/);
  const paid = pc.system.stats.intellect.pool.value;
  pc.flags = JSON.parse(JSON.stringify(pc.flags)); pc.createEmbeddedDocuments = create;
  const pending = Object.values(pc.flags.cypher.companionEffects)[0];
  assert.equal(await resumeCompanionUpgrade(pc, pending.id), true);
  assert.equal(pc.system.stats.intellect.pool.value, paid);
  assert.equal([...pc.items.values()].filter(item => item.type === "armor").length, 1);
});

test("field protection survives Armor bypass, does not stack and expires on ten-minute recovery", async () => {
  const id = await install("automaton-force-field-upgrade");
  assert.equal(await activateCompanionUpgrade(pc, id, { confirmed: true, immediate: true, targetUuids: [pc.uuid] }), true);
  assert.equal(await applyNpcDamage(npc, 5, { ignoreArmor: true }), 2);
  applyDocumentUpdate(pc, companionRecoveryUpdates(pc.flags.cypher, "tenMinutes"));
  assert.equal(await applyNpcDamage(npc, 5, { ignoreArmor: true }), 5);
});

test("flight installation survives normal-form changes but a live turret is immobile", async () => {
  await install("automaton-flight-upgrade");
  assert.equal(automatonFlight(npc).range, "long");
  const id = await install("automaton-turret-upgrade");
  assert.equal(await activateCompanionUpgrade(pc, id, { confirmed: true }), true);
  assert.equal(automatonFlight(npc).enabled, false);
  npc.statuses = new Set(["stunned"]);
  assert.equal(await endCompanionUpgrade(pc, effect("automaton-turret-upgrade").id), false);
  npc.statuses.clear();
  await endCompanionUpgrade(pc, effect("automaton-turret-upgrade").id);
  assert.equal(automatonFlight(npc).enabled, true);
});

test("validation rejects duplicate installations, insufficient Pools, non-GM authority and unauthorized recipients before payment", async () => {
  const id = await install("automaton-heavy-armor-upgrade"), before = JSON.stringify(pc.flags);
  assert.equal(await installCompanionUpgrade(pc, ability("automaton-heavy-armor-upgrade"), followerId, { confirmed: true }), false);
  pc.system.stats.intellect.pool.value = 1;
  assert.equal(await activateCompanionUpgrade(pc, id, { confirmed: true }), false);
  assert.equal(JSON.stringify(pc.flags), before);
  pc.system.stats.intellect.pool.value = 20;
  game.user.isGM = false;
  assert.equal(await activateCompanionUpgrade(pc, id, { confirmed: true }), false);
  game.user.isGM = true;
  const field = await install("automaton-force-field-upgrade"); npc.isOwner = false;
  assert.equal(await activateCompanionUpgrade(pc, field, { confirmed: true, immediate: true }), false);
  assert.equal(pc.flags.cypher.companionEffects, undefined);
});

test("a partial final acknowledgement resumes without reusing the action or restoring damaged armor", async () => {
  const id = await install("automaton-armor-upgrade"), update = pc.update;
  let failed = false;
  pc.update = async function (changes) {
    if (!failed && Object.entries(changes).some(([key, value]) => key.endsWith(".state") && value === "active")) { failed = true; throw Error("ack lost"); }
    await update.call(this, changes);
  };
  await assert.rejects(activateCompanionUpgrade(pc, id, { confirmed: true, immediate: true }), /ack lost/);
  const pending = Object.values(pc.flags.cypher.companionEffects)[0];
  const armor = [...pc.items.values()].find(item => item.type === "armor"); armor.system.blockEaseDamage = 1;
  assert.equal(companionEquipmentUsable(armor), false);
  assert.equal(await resumeCompanionUpgrade(pc, pending.id), true);
  assert.equal(armor.system.blockEaseDamage, 1);
  assert.equal(pc.system.stats.intellect.pool.value, 18);
  pc.flags.cypher.followers[followerId].npcUuid = "Actor.replacement";
  assert.equal(companionEquipmentUsable(armor), false);
});

test("PC field reduces wounds once but a shield absorbs the original severity", async () => {
  const id = await install("automaton-force-field-upgrade");
  await activateCompanionUpgrade(pc, id, { confirmed: true, immediate: true, targetUuids: [pc.uuid] });
  pc.statuses = new Set();
  pc.system.wounds = Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }]));
  await applyDefenseConsequences(pc, { defenseType: "dodge", success: false, applyIncomingWound: true, incomingSeverity: "major", incomingWounds: 1 });
  assert.equal(pc.system.wounds.moderate.current, 1); assert.equal(pc.system.wounds.minor.current, 0);
  const shield = { id: "shield", type: "shield", isOwner: true, system: { equipped: true, wounds: {
    minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 1 }
  } }, async update(changes) { applyDocumentUpdate(this, changes); } };
  pc.items.set(shield.id, shield);
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  globalThis.foundry.utils.escapeHTML = value => value;
  const result = await applyDefenseConsequences(pc, { defenseType: "block", success: true, applyIncomingWound: true, incomingSeverity: "moderate", incomingWounds: 1,
    usingShield: true, shieldItem: shield });
  assert.equal(result.shieldWoundsAbsorbed, 1); assert.equal(shield.system.wounds.moderate.current, 1);
  assert.equal(pc.system.wounds.minor.current, 0);
});

test("an attack reroll keeps the field protection from the original attack after recovery", async () => {
  const id = await install("automaton-force-field-upgrade");
  await activateCompanionUpgrade(pc, id, { confirmed: true, immediate: true });
  npc.system.health = { value: 20, max: 20 };
  const initial = await applyAttackConsequences(npc, { success: true, totalDamage: 7, armorBypass: 0, weaponTargetEffects: [], weaponSource: {} });
  assert.equal(initial.attackConsequences.protection, 3); assert.equal(npc.system.health.value, 17);
  applyDocumentUpdate(pc, companionRecoveryUpdates(pc.flags.cypher, "tenMinutes"));
  await reconcileAttackConsequences(npc, initial, { success: true, totalDamage: 9 }, async () => {});
  assert.equal(npc.system.health.value, 15);
});

test("Beast Eyes uses the declared actual token, suspends on range/disposition and never changes ownership", async () => {
  ability("soothe-the-savage"); const item = ability("beast-eyes");
  await configureCompanion(pc, { confirmed: true, calmedNpcUuid: npc.uuid, friendly: true });
  const tokenDocument = { uuid: "Scene.s.Token.t", actor: npc, parent: { id: "s" }, level: "level" };
  docs.set(tokenDocument.uuid, tokenDocument);
  pc.testUserPermission = () => true;
  globalThis.canvas = { scene: { id: "s" }, level: { id: "level" }, visibility: { tokenVision: true }, tokens: { placeables: [] } };
  game.actors = { contents: [pc] };
  assert.equal(await activateCompanionUpgrade(pc, item, { confirmed: true, withinRange: true, visionTokenUuid: tokenDocument.uuid }), true);
  const token = { document: tokenDocument, actor: npc };
  assert.equal(beastEyesVision(token), true);
  pc.flags.cypher.companionContext.friendly = false;
  assert.equal(beastEyesVision(token), false);
  pc.flags.cypher.companionContext.friendly = true;
  applyDocumentUpdate(pc, companionRecoveryUpdates(pc.flags.cypher, "tenMinutes"));
  assert.equal(beastEyesVision(token), false); assert.equal(npc.ownership, undefined);
});

test("autonomous turret uses exactly seven damage, actual Armor and one declared round", async () => {
  const id = await install("automaton-turret-upgrade");
  await activateCompanionUpgrade(pc, id, { confirmed: true });
  pc.flags.cypher.followers[followerId].mode = "independent";
  const target = document("Actor.enemy", "npc"); target.system = { armor: 2, health: { value: 20, max: 20 } };
  const source = effect("automaton-turret-upgrade");
  const weapon = [...pc.items.values()].find(item => item.type === "attack");
  pc.system.freeWeaponCategories = ["heavy"];
  weapon.flags.cypher.equipmentUse = { version: 1, held: true, hands: 2, deployed: true, operators: [] };
  const operator = prepareAttackOptions(weapon, { target });
  assert.equal(operator.baseDamage, 7); assert.equal(operator.extraEaseSteps, 1);
  assert.equal(operator.weaponSource.actionTiming, "lastAction");
  assert.equal(await fireAutomatonTurret(pc, source.id, { confirmed: true, inRange: true, roundId: "r1", hitConfirmed: true, target }), true);
  assert.equal(target.system.health.value, 15);
  assert.equal(await fireAutomatonTurret(pc, source.id, { confirmed: true, inRange: true, roundId: "r1", hitConfirmed: true, target }), false);
  assert.equal(target.system.health.value, 15);
});

test("a successful defense reroll preserves its original field reduction and unrelated wounds after expiry", async () => {
  const id = await install("automaton-force-field-upgrade");
  await activateCompanionUpgrade(pc, id, { confirmed: true, immediate: true, targetUuids: [pc.uuid] });
  pc.statuses = new Set();
  pc.system.wounds = Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }]));
  const flags = { defenseType: "block", applyIncomingWound: true, incomingSeverity: "major", incomingWounds: 1 };
  Object.assign(flags, await applyDefenseConsequences(pc, { ...flags, success: false }));
  assert.equal(pc.system.wounds.moderate.current, 1);
  pc.system.wounds.minor.current = 1;
  applyDocumentUpdate(pc, companionRecoveryUpdates(pc.flags.cypher, "tenMinutes"));
  const corrected = await reconcileDefenseConsequences(pc, flags, { success: true }, async () => {}, null);
  assert.equal(corrected.defenseConsequences.state, "corrected");
  assert.equal(pc.system.wounds.moderate.current, 0); assert.equal(pc.system.wounds.minor.current, 2);
});

test("a redirected failure keeps the original defender's field for a successful Block reroll", async () => {
  const id = await install("automaton-force-field-upgrade");
  await activateCompanionUpgrade(pc, id, { confirmed: true, immediate: true, targetUuids: [pc.uuid] });
  const interceptor = document("Actor.interceptor", "pc"); interceptor.statuses = new Set(); pc.statuses = new Set();
  for (const actor of [pc, interceptor]) actor.system.wounds = Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }]));
  const flags = { defenseType: "block", applyIncomingWound: true, incomingSeverity: "moderate", incomingWounds: 1, incomingFieldReduction: 1 };
  Object.assign(flags, await applyDefenseConsequences(interceptor, { ...flags, success: false }));
  applyDocumentUpdate(pc, companionRecoveryUpdates(pc.flags.cypher, "tenMinutes"));
  const corrected = await reconcileDefenseConsequences(pc, flags, { success: true }, async () => {}, null, interceptor);
  assert.equal(corrected.defenseConsequences.state, "corrected");
  assert.equal(interceptor.system.wounds.moderate.current, 0);
  assert.equal(pc.system.wounds.minor.current, 0);
});

test("the action receipt survives an uncertain managed-round response and later round revisions", async () => {
  const combat = { flags: { cypher: { roundFlow: { version: 1, revision: 1 } } }, id: "combat" };
  const action = { actor: npc, combat, flow: combat.flags.cypher.roundFlow, step: { id: "step" }, kind: "primary", used: {} };
  const update = npc.update;
  npc.update = async function(changes) { await update.call(this, changes); throw Error("lost action response"); };
  await assert.rejects(consumeRoundAction(action, null, { receiptId: "activation" }), /lost action response/);
  npc.update = async () => assert.fail("An acknowledged action cannot be consumed twice");
  combat.flags.cypher.roundFlow = { version: 1, revision: 2 };
  assert.equal(await consumeRoundAction(action, null, { receiptId: "activation" }), true);
});
