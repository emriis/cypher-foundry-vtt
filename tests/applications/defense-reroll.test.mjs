/** CRD / Rerolling 8079–8080 and Armor and Shields 7930–7935. */
import assert from "node:assert/strict";
import test from "node:test";
import { rollDefense } from "../../module/applications/task-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
import { addWound } from "../../module/applications/damage-service.mjs";
import { rollNpcAttack } from "../../module/applications/npc-combat-service.mjs";
import { stampDefenseRevisions } from "../../module/applications/defense-history.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";

function scenario(values = [4, 12, 3]) {
  const messages = new Map(), warnings = [], rolls = [], updates = [];
  let nextId = 0;
  const messageDocument = data => {
    const message = { id: `message-${nextId++}`, isOwner: true, ...data,
      getFlag(namespace, key) { return this.flags?.[namespace]?.[key]; },
      async update(change) { applyDocumentUpdate(this, change); } };
    messages.set(message.id, message);
    return message;
  };
  globalThis.game = { messages, i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { error() {}, warn: message => warnings.push(message) } };
  globalThis.foundry = { utils: { escapeHTML: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => messageDocument(data) };
  globalThis.Roll = class {
    async evaluate() { this.total = values.shift(); rolls.push(this.total); return this; }
    async toMessage(data) { return messageDocument(data); }
  };
  const actor = { id: "pc", uuid: "Actor.pc", type: "pc", isOwner: true, flags: {}, items: new Map(), statuses: new Set(),
    system: { xp: 5, effort: 2, hinderSteps: 0, armor: {}, customStats: [],
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 10, max: 10 }, edge: 0 }])),
      wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(changes, options = {}) {
      stampDefenseRevisions(this, changes, options);
      updates.push(structuredClone(changes));
      applyDocumentUpdate(this, changes);
    },
    async toggleStatusEffect(status, { active }) { if (active) this.statuses.add(status); else this.statuses.delete(status); }
  };
  Object.defineProperty(actor.system, "dead", { get: () => actor.system.wounds.major.current >= 3 });
  globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : null;
  const shield = { id: "shield", type: "shield", name: "Shield", isOwner: true,
    system: { equipped: true, wounds: { minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 1 } } },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  actor.items.set(shield.id, shield);
  return { actor, shield, messages, warnings, rolls, updates,
    task: () => [...messages.values()].find(message => message.flags?.cypher?.rollType === "task") };
}

test("a failed Dodge reroll removes only its own wound and later old-card rerolls cannot heal again", async () => {
  const s = scenario();
  await rollDefense(s.actor, "dodge", { incomingSeverity: "moderate" });
  const origin = s.task();
  await addWound(s.actor, "moderate");
  await rerollMessage(s.actor, origin);
  assert.equal(s.actor.system.wounds.moderate.current, 1);
  assert.equal(s.actor.system.xp, 4);
  const reroll = [...s.messages.values()].at(-1);
  await addWound(s.actor, "moderate");
  await rerollMessage(s.actor, reroll);
  assert.equal(s.actor.system.wounds.moderate.current, 2);
  assert.equal(origin.flags.cypher.d20, 12);
  assert.equal(s.actor.system.xp, 3);
});

test("a failed Block turned successful transfers its wound to the selected shield once", async () => {
  const s = scenario();
  await rollDefense(s.actor, "block", { incomingSeverity: "major", shieldItemId: s.shield.id });
  await addWound(s.actor, "minor");
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.wounds.major.current, 0);
  assert.equal(s.actor.system.wounds.minor.current, 1);
  assert.equal(s.shield.system.wounds.major.current, 1);
  assert.equal(s.shield.system.equipped, false);
  await rerollMessage(s.actor, s.task());
  assert.equal(s.shield.system.wounds.major.current, 1);
  assert.equal(s.actor.system.wounds.minor.current, 1);
});

test("overflow attribution records the actual major wound rather than the declared minor severity", async () => {
  const s = scenario();
  s.actor.system.wounds.minor.current = 3;
  s.actor.system.wounds.moderate.current = 3;
  await rollDefense(s.actor, "dodge", { incomingSeverity: "minor" });
  await addWound(s.actor, "major");
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.wounds.major.current, 1);
  assert.equal(s.actor.system.wounds.minor.current, 3);
  assert.equal(s.actor.system.wounds.moderate.current, 3);
});

test("rerolling an already successful shield Block never repairs the destroyed shield", async () => {
  const s = scenario([12, 19]);
  await rollDefense(s.actor, "block", { incomingSeverity: "major", shieldItemId: s.shield.id });
  await rerollMessage(s.actor, s.task());
  assert.equal(s.shield.system.wounds.major.current, 1);
  assert.equal(s.shield.system.equipped, false);
  assert.equal(s.actor.system.wounds.major.current, 0);
});

test("correcting one defense preserves attribution of another pending defense", async () => {
  const s = scenario([4, 5, 12, 12]);
  await rollDefense(s.actor, "dodge", { incomingSeverity: "moderate" });
  const first = s.task();
  await rollDefense(s.actor, "dodge", { incomingSeverity: "moderate" });
  const second = [...s.messages.values()].at(-1);
  await rerollMessage(s.actor, first);
  await rerollMessage(s.actor, second);
  assert.equal(s.actor.system.wounds.moderate.current, 0);
  assert.equal(s.actor.system.xp, 3);
});

test("a successful ordinary Block replaces the original major wound with one moderate wound", async () => {
  const s = scenario();
  await rollDefense(s.actor, "block", { incomingSeverity: "major" });
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.wounds.major.current, 0);
  assert.equal(s.actor.system.wounds.moderate.current, 1);
});

test("a shield destroyed by a later action stays destroyed when an earlier failed Block is rerolled", async () => {
  const s = scenario();
  await rollDefense(s.actor, "block", { incomingSeverity: "major", shieldItemId: s.shield.id });
  await s.shield.update({ "system.wounds.major.current": 1, "system.equipped": false });
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.wounds.major.current, 0);
  assert.equal(s.actor.system.wounds.moderate.current, 1);
  assert.equal(s.shield.system.wounds.major.current, 1);
  assert.equal(s.shield.system.equipped, false);
});

test("intervening healing never lets a reroll remove a later unrelated wound", async () => {
  const s = scenario();
  await rollDefense(s.actor, "dodge", { incomingSeverity: "moderate" });
  await s.actor.update({ "system.wounds.moderate.current": 0 });
  await addWound(s.actor, "moderate");
  const metadata = await rerollMessage(s.actor, s.task());
  assert.equal(metadata.d20, 12);
  assert.equal(metadata.defenseConsequences.state, "manual");
  assert.equal(s.actor.system.wounds.moderate.current, 1);
  assert.match(s.warnings[0], /DefenseCorrectionManual/);
});

test("a defense without recorded history remains rerollable but never guesses which wounds to remove", async () => {
  const s = scenario();
  await rollDefense(s.actor, "dodge", { incomingSeverity: "moderate" });
  delete s.task().flags.cypher.defenseConsequences;
  const metadata = await rerollMessage(s.actor, s.task());
  assert.equal(metadata.d20, 12);
  assert.equal(metadata.defenseConsequences.state, "manual");
  assert.equal(s.actor.system.wounds.moderate.current, 1);
});

test("a paid NPC Pool-defense reroll restores only its recorded loss and overflow wound", async () => {
  const s = scenario();
  s.actor.system.stats.might.pool.value = 2;
  const npc = { type: "npc", system: { level: 3 }, async update(changes) { applyDocumentUpdate(this, changes); } };
  await rollNpcAttack(npc, { damage: { mode: "pool", stat: "might", amount: 7 } }, { target: s.actor, defenseType: "dodge" });
  assert.equal(s.actor.system.stats.might.pool.value, 0);
  assert.equal(s.actor.system.wounds.moderate.current, 1);
  await addWound(s.actor, "major");
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.stats.might.pool.value, 2);
  assert.equal(s.actor.system.wounds.moderate.current, 0);
  assert.equal(s.actor.system.wounds.major.current, 1);
});

test("a partial shield write failure checkpoints the origin and prevents a second wound subtraction", async () => {
  const s = scenario([4, 12, 15]);
  await rollDefense(s.actor, "block", { incomingSeverity: "major", shieldItemId: s.shield.id });
  const update = s.shield.update;
  s.shield.update = async () => { throw new Error("shield failed"); };
  await assert.rejects(rerollMessage(s.actor, s.task()), /shield failed/);
  assert.equal(s.task().flags.cypher.defenseConsequences.state, "pending");
  assert.equal(s.actor.system.wounds.major.current, 0);
  await addWound(s.actor, "major");
  s.shield.update = update;
  const metadata = await rerollMessage(s.actor, s.task());
  assert.equal(metadata.defenseConsequences.state, "manual");
  assert.equal(metadata.defenseConsequences.reason, "partial");
  assert.equal(s.actor.system.wounds.major.current, 1);
  assert.equal(s.shield.system.wounds.major.current, 0);
});

test("an unauthorized defender rejects before paying for another character's roll", async () => {
  const s = scenario();
  await rollDefense(s.actor, "dodge", { incomingSeverity: "moderate" });
  s.actor.isOwner = false;
  const payer = { type: "pc", isOwner: true, system: { xp: 5 }, async update() { assert.fail("XP must not be spent"); } };
  assert.equal(await rerollMessage(payer, s.task()), null);
  assert.equal(s.rolls.length, 1);
});

test("correcting a lethal defense also removes the derived Dead token status", async () => {
  const s = scenario();
  s.actor.system.wounds.major.current = 2;
  await rollDefense(s.actor, "dodge", { incomingSeverity: "major" });
  assert.equal(s.actor.statuses.has("dead"), true);
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.wounds.major.current, 2);
  assert.equal(s.actor.statuses.has("dead"), false);
});

test("defense revisions accept dotted and expanded healing deltas without changing the document themselves", () => {
  const s = scenario();
  s.actor.system.wounds.moderate.current = 2;
  for (const changes of [{ "system.wounds.moderate.current": "1" }, { system: { wounds: { moderate: { current: 0 } } } }]) {
    stampDefenseRevisions(s.actor, changes);
    assert.equal(changes.flags.cypher.defenseRevisions.wound_moderate, 1);
    assert.equal(s.actor.flags.cypher, undefined);
    assert.equal(s.actor.system.wounds.moderate.current, 2);
  }
});

test("a defense reroll corrects incoming wounds without returning or spending the original Effort again", async () => {
  const s = scenario();
  await rollDefense(s.actor, "dodge", { incomingSeverity: "moderate", difficulty: 4, effortLevels: 1 });
  assert.equal(s.actor.system.stats.speed.pool.value, 7);
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.wounds.moderate.current, 0);
  assert.equal(s.actor.system.stats.speed.pool.value, 7);
  assert.equal(s.actor.system.xp, 4);
});

test("the retained natural-20 exception refunds a defense's original point cost once, never its reroll XP", async () => {
  const s = scenario([4, 20, 20]);
  await rollDefense(s.actor, "dodge", { incomingSeverity: "moderate", difficulty: 4, effortLevels: 1 });
  assert.equal(s.actor.system.stats.speed.pool.value, 7);
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.wounds.moderate.current, 0);
  assert.equal(s.actor.system.stats.speed.pool.value, 10);
  await s.actor.update({ "system.stats.speed.pool.value": 7 });
  await rerollMessage(s.actor, s.task());
  assert.equal(s.actor.system.stats.speed.pool.value, 7);
  assert.equal(s.actor.system.xp, 3);
});

test("an origin-write failure after correction/refund cannot refund the same defense a second time", async () => {
  const s = scenario([4, 20, 20]);
  await rollDefense(s.actor, "block", { incomingSeverity: "major", difficulty: 4, effortLevels: 1, shieldItemId: s.shield.id });
  const origin = s.task(), update = origin.update;
  origin.update = async changes => {
    if (changes["flags.cypher"]?.defenseConsequences?.state === "corrected") throw new Error("origin failed");
    await update.call(origin, changes);
  };
  await assert.rejects(rerollMessage(s.actor, origin), /origin failed/);
  assert.equal(s.actor.system.stats.might.pool.value, 10);
  assert.equal(origin.flags.cypher.defenseConsequences.state, "pending");
  origin.update = update;
  await s.actor.update({ "system.stats.might.pool.value": 9 });
  await rerollMessage(s.actor, origin);
  assert.equal(s.actor.system.stats.might.pool.value, 9);
  assert.equal(s.actor.system.xp, 3);
  assert.equal(origin.flags.cypher.defenseConsequences.reason, "partial");
});
