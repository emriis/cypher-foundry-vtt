/** CRD 2026-07-29 / Actions and Initiative 7641–7651. */
import assert from "node:assert/strict";
import test from "node:test";
import { rollCombatInitiative, rollNpcInitiative } from "../../module/applications/combat-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { skipUnyieldingShieldTurn } from "../../module/applications/shield-lifecycle-service.mjs";

function scenario(dice = [6, 15]) {
  const messages = new Map();
  const message = data => {
    const document = { id: String(messages.size), isOwner: true, ...data,
      getFlag(namespace, key) { return this.flags?.[namespace]?.[key]; },
      async update(changes) { applyDocumentUpdate(this, changes); } };
    messages.set(document.id, document);
    return document;
  };
  globalThis.game = { messages, i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => message(data) };
  globalThis.Roll = class {
    async evaluate() { this.total = dice.shift(); return this; }
    async toMessage(data) { return message(data); }
  };
  const pc = { id: "pc", uuid: "Scene.s.Token.t.Actor.pc", type: "pc", isOwner: true, flags: {}, items: new Map(),
    system: { effort: 2, xp: 4, hinderSteps: 0, armor: {}, customStats: [],
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 10, max: 10 }, edge: 0 }])),
      wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  const npc = { id: "npc", type: "npc", isOwner: true, system: { level: 2 } };
  const combat = { uuid: "Combat.combat", combatants: new Map(), turn: null,
    async updateEmbeddedDocuments(type, updates) {
      assert.equal(type, "Combatant");
      for (const { _id, ...change } of updates) applyDocumentUpdate(this.combatants.get(_id), change);
    } };
  for (const actor of [pc, npc]) combat.combatants.set(actor.id, { id: actor.id, actor, isOwner: true,
    parent: combat, flags: {}, initiative: null });
  globalThis.fromUuid = async uuid => uuid === combat.uuid ? combat : uuid === pc.uuid ? pc : null;
  return { pc, combat, messages, dice, origin: () => [...messages.values()][0] };
}

test("initiative adds three per easing step without clamping a routine difficulty", async () => {
  const s = scenario();
  await rollCombatInitiative(s.combat, ["pc", "npc"], { chooseOptions: async () => ({ effortLevels: 1, assetSteps: 1 }) });
  assert.equal(s.combat.combatants.get("pc").initiative, 12);
  assert.equal(s.combat.combatants.get("npc").initiative, 6);
  assert.equal(s.pc.system.stats.speed.pool.value, 7);
  assert.equal(s.dice.length, 1); // NPCs never roll a die.
});

test("Roll NPC does not request a Speed roll for a GM-owned PC without player ownership", async () => {
  const s = scenario();
  s.combat.combatants.get("pc").isNPC = true; // Core's hasPlayerOwner heuristic.
  await rollNpcInitiative(s.combat, { chooseOptions: () => assert.fail("A PC is not an NPC") });
  assert.equal(s.combat.combatants.get("npc").initiative, 6);
  assert.equal(s.combat.combatants.get("pc").initiative, null);
  assert.equal(s.dice.length, 2);
});

test("initiative rerolls update only the original combatant using frozen modifiers", async () => {
  const s = scenario();
  await rollCombatInitiative(s.combat, "pc", { chooseOptions: async () => ({ assetSteps: 1 }) });
  s.pc.system.hinderSteps = 2;
  await rerollMessage(s.pc, s.origin());
  assert.equal(s.combat.combatants.get("pc").initiative, 18);
  assert.equal(s.pc.system.xp, 3);
});

test("cancellation, insufficient Speed and unowned combatants consume no costs or dice", async () => {
  for (const reason of ["cancel", "pool", "permission"]) {
    const s = scenario();
    if (reason === "pool") s.pc.system.stats.speed.pool.value = 0;
    if (reason === "permission") s.combat.combatants.get("pc").isOwner = false;
    await rollCombatInitiative(s.combat, "pc", { chooseOptions: async () => reason === "cancel" ? null : { effortLevels: 1 } });
    assert.equal(s.dice.length, 2);
    assert.equal(s.combat.combatants.get("pc").initiative, null);
    assert.equal(s.pc.system.stats.speed.pool.value, reason === "pool" ? 0 : 10);
    assert.equal(s.messages.size, 0);
  }
});

test("wounds, unfamiliar armor and explicit inability reduce initiative without clamping", async () => {
  const s = scenario([1]);
  s.pc.system.hinderSteps = 1;
  s.pc.system.armor.speedTaskHinder = 1;
  await rollCombatInitiative(s.combat, "pc", { chooseOptions: async () => ({ extraHinderSteps: 1, rollRoutine: false }) });
  assert.equal(s.combat.combatants.get("pc").initiative, -8);
});

test("a new initiative roll supersedes older cards before reroll XP is paid", async () => {
  const s = scenario([6, 10, 20]);
  await rollCombatInitiative(s.combat, "pc");
  const first = s.origin();
  await rollCombatInitiative(s.combat, "pc");
  assert.equal(await rerollMessage(s.pc, first), null);
  assert.equal(s.pc.system.xp, 4);
  assert.equal(s.dice.length, 1);
  assert.equal(s.combat.combatants.get("pc").initiative, 10);
});

test("manual initiative edits and deleted encounters reject old rerolls before costs", async () => {
  for (const deleted of [false, true]) {
    const s = scenario();
    await rollCombatInitiative(s.combat, "pc");
    if (deleted) s.combat.combatants.delete("pc");
    else s.combat.combatants.get("pc").initiative = 99;
    assert.equal(await rerollMessage(s.pc, s.origin()), null);
    assert.equal(s.pc.system.xp, 4);
  }
});

test("natural twenty refunds original initiative cost once across serialized old cards", async () => {
  const s = scenario([6, 20, 4]);
  await rollCombatInitiative(s.combat, "pc", { chooseOptions: async () => ({ effortLevels: 1 }) });
  assert.equal(s.pc.system.stats.speed.pool.value, 7);
  s.origin().flags = JSON.parse(JSON.stringify(s.origin().flags));
  await rerollMessage(s.pc, s.origin());
  assert.equal(s.combat.combatants.get("pc").initiative, 23);
  assert.equal(s.pc.system.stats.speed.pool.value, 10);
  await s.pc.update({ "system.stats.speed.pool.value": 5 });
  await rerollMessage(s.pc, [...s.messages.values()].at(-1));
  assert.equal(s.combat.combatants.get("pc").initiative, 23);
  assert.equal(s.pc.system.stats.speed.pool.value, 5);
  assert.equal(s.pc.system.xp, 2);
});

test("a partial initiative write cannot duplicate a cost refund or overwrite the tracker on retry", async () => {
  const s = scenario([6, 20, 20]);
  await rollCombatInitiative(s.combat, "pc", { chooseOptions: async () => ({ effortLevels: 1 }) });
  const update = s.origin().update;
  s.origin().update = async function(changes) {
    if (changes["flags.cypher"].initiative.state !== "pending") throw Error("final chat failed");
    return update.call(this, changes);
  };
  await assert.rejects(rerollMessage(s.pc, s.origin()), /final chat failed/);
  await s.pc.update({ "system.stats.speed.pool.value": 5 });
  s.origin().update = update;
  const metadata = await rerollMessage(s.pc, s.origin());
  assert.equal(metadata.initiative.state, "manual");
  assert.equal(s.pc.system.stats.speed.pool.value, 5);
  assert.equal(s.combat.combatants.get("pc").initiative, 23);
});

test("partial failed score persistence leaves other combatants and the accepted result intact", async () => {
  const s = scenario([6, 15, 18]);
  await rollCombatInitiative(s.combat, ["pc", "npc"]);
  const persist = s.combat.updateEmbeddedDocuments;
  s.combat.updateEmbeddedDocuments = async () => { throw Error("initiative write failed"); };
  await assert.rejects(rerollMessage(s.pc, s.origin()), /initiative write failed/);
  s.combat.updateEmbeddedDocuments = persist;
  const metadata = await rerollMessage(s.pc, s.origin());
  assert.equal(metadata.initiative.state, "manual");
  assert.equal(metadata.initiative.score, 18);
  assert.equal(s.combat.combatants.get("pc").initiative, 6);
  assert.equal(s.combat.combatants.get("npc").initiative, 6);
});

test("an initiative reorder cannot consume a pending shield turn loss", async () => {
  const s = scenario();
  game.user = { id: "gm", isGM: true };
  game.users = { activeGM: game.user };
  s.pc.flags.cypher = { shieldTurnLossPending: true };
  await skipUnyieldingShieldTurn({ started: true, combatant: { actor: s.pc },
    async nextTurn() { assert.fail("initiative editing is not turn advancement"); } },
  { turn: 1 }, { cypherInitiativeReorder: true });
  assert.equal(s.pc.flags.cypher.shieldTurnLossPending, true);
});
