/** CRD 2026-07-29 / Special Rolls 7572–7578; Rerolling 8079–8081. */
import assert from "node:assert/strict";
import test from "node:test";
import { rollTask } from "../../module/applications/task-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { stampAttackHealthRevision } from "../../module/applications/attack-history.mjs";
import { expireWeaponEffectsAfterAction, getActiveWeaponEffects } from "../../module/applications/weapon-effect-service.mjs";

function scenario(values = [4, 12, 18]) {
  const messages = new Map(), warnings = [];
  const document = data => {
    const message = { id: `message-${messages.size}`, isOwner: true, ...data,
      getFlag(namespace, key) { return this.flags?.[namespace]?.[key]; },
      async update(changes) { applyDocumentUpdate(this, changes); } };
    messages.set(message.id, message);
    return message;
  };
  globalThis.game = { messages, i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { error() {}, warn: note => warnings.push(note) } };
  globalThis.foundry = { utils: { escapeHTML: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => document(data) };
  globalThis.Roll = class {
    async evaluate() { this.total = values.shift(); return this; }
    async toMessage(data) { return document(data); }
  };
  const actor = { id: "pc", uuid: "Actor.pc", type: "pc", isOwner: true, items: new Map(), flags: {},
    system: { xp: 10, effort: 2, hinderSteps: 0, armor: {}, customStats: [],
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 10, max: 10 }, edge: 0 }])),
      wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  const target = { id: "npc", uuid: "Scene.scene.Token.target.Actor.npc", type: "npc", isOwner: true,
    flags: {}, system: { armor: 1, health: { value: 20, max: 20 } },
    async update(changes, options = {}) { stampAttackHealthRevision(this, changes, options); applyDocumentUpdate(this, changes); } };
  globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : uuid === target.uuid ? target : null;
  return { actor, target, warnings, messages,
    attack: options => rollTask(actor, { isAttack: true, difficulty: 3, baseDamage: 5, targetActor: target, ...options }),
    origin: () => [...messages.values()][0] };
}

test("attack rerolls apply only their damage delta and retain the original synthetic target", async () => {
  const s = scenario();
  await s.attack({ effortLevels: 1 });
  assert.equal(s.target.system.health.value, 20);
  await rerollMessage(s.actor, s.origin());
  assert.equal(s.target.system.health.value, 16);
  await s.target.update({ "system.health.value": 13 });
  await rerollMessage(s.actor, s.origin());
  assert.equal(s.target.system.health.value, 11);
  assert.equal(s.actor.system.stats.might.pool.value, 7);
  assert.equal(s.actor.system.xp, 8);
});

test("the original Armor and bypass are frozen even if the target changes equipment", async () => {
  const s = scenario([4, 18]);
  s.target.system.armor = 3;
  await s.attack({ armorBypass: 2 });
  s.target.system.armor = 10;
  await rerollMessage(s.actor, s.origin());
  assert.equal(s.target.system.health.value, 14);
});

test("a major effect replaces bonus damage without refunding action costs or unrelated damage", async () => {
  const s = scenario([18, 20, 3]);
  await s.attack({ effortLevels: 1 });
  await s.target.update({ "system.health.value": 11 });
  const metadata = await rerollMessage(s.actor, s.origin(), { chooseSpecialEffect: async () => "major" });
  assert.equal(s.target.system.health.value, 13);
  assert.equal(metadata.specialEffectChoice, "major");
  assert.equal(s.actor.system.stats.might.pool.value, 10);
  assert.equal(metadata.costRefunded, true);
  await s.actor.update({ "system.stats.might.pool.value": 7 });
  const lastCard = [...s.messages.values()].at(-1);
  await rerollMessage(s.actor, lastCard, { chooseSpecialEffect: () => { throw Error("unchanged result must retain its choice"); } });
  assert.equal(s.target.system.health.value, 13);
  assert.equal(s.actor.system.stats.might.pool.value, 7);
  assert.equal(s.actor.system.xp, 8);
  assert.ok(s.warnings.some(note => note.endsWith("AttackNarrativeEffect")));
});

test("overkill restoration removes only the bonus that actually reduced Health", async () => {
  const s = scenario([18, 20]);
  s.target.system.health.value = 5;
  await s.attack(); // six potential damage, five actual Health lost.
  await rerollMessage(s.actor, s.origin(), { chooseSpecialEffect: async () => "major" });
  assert.equal(s.target.system.health.value, 1); // base damage four, not a two-point refund.
});

test("successive special choices and serialized old cards compare against the authoritative origin", async () => {
  const s = scenario([4, 19, 20, 12]);
  await s.attack();
  await rerollMessage(s.actor, s.origin(), { chooseSpecialEffect: async () => "minor" });
  const oldCard = [...s.messages.values()].at(-1);
  assert.equal(s.target.system.health.value, 16);
  // Reload has plain serialized flags, with no reference to the original Item.
  s.origin().flags = JSON.parse(JSON.stringify(s.origin().flags));
  await rerollMessage(s.actor, s.origin(), { chooseSpecialEffect: async () => "damage" });
  assert.equal(s.target.system.health.value, 12);
  await rerollMessage(s.actor, oldCard);
  assert.equal(s.target.system.health.value, 12);
  assert.equal(oldCard.flags.cypher.d20, 20);
});

test("healing invalidates an old attack's damage attribution", async () => {
  const s = scenario([12, 18]);
  await s.attack();
  await s.target.update({ system: { health: { value: 18 } } });
  await s.target.update({ "system.health.value": 13 });
  const metadata = await rerollMessage(s.actor, s.origin());
  assert.equal(metadata.attackConsequences.state, "manual");
  assert.equal(s.target.system.health.value, 13);
  assert.ok(s.warnings.some(note => note.endsWith("AttackCorrectionManual")));
});

test("known corrections preserve attribution of other attacks", async () => {
  const s = scenario([18, 18, 20, 20]);
  await s.attack();
  const first = s.origin();
  await s.attack();
  const second = [...s.messages.values()].at(-1);
  await rerollMessage(s.actor, first, { chooseSpecialEffect: async () => "major" });
  await rerollMessage(s.actor, second, { chooseSpecialEffect: async () => "major" });
  assert.equal(s.target.system.health.value, 12);
  assert.equal(s.target.flags.cypher?.attackHealthRevision ?? 0, 0);
});

test("a missing or unowned original target rejects the reroll before XP and dice", async () => {
  for (const missing of [false, true]) {
    const s = scenario();
    await s.attack();
    if (missing) globalThis.fromUuid = async () => null;
    else s.target.isOwner = false;
    assert.equal(await rerollMessage(s.actor, s.origin()), null);
    assert.equal(s.actor.system.xp, 10);
  }
});

test("legacy cards never guess the target from a world Actor ID", async () => {
  const s = scenario();
  await s.attack();
  delete s.origin().flags.cypher.attackConsequences;
  const metadata = await rerollMessage(s.actor, s.origin());
  assert.equal(metadata.d20, 12);
  assert.equal(metadata.attackConsequences.state, "manual");
  assert.equal(s.target.system.health.value, 20);
});

const hinder = { effect: "hindered", hinderSteps: 1, duration: "one round" };
test("a newly successful attack adds structured effects once without refreshing their interval", async () => {
  const s = scenario([4, 12, 18]);
  game.combat = { id: "combat", round: 2 };
  await s.attack({ weaponTargetEffects: [hinder] });
  await rerollMessage(s.actor, s.origin());
  assert.equal(getActiveWeaponEffects(s.target).length, 1);
  game.combat.round = 3;
  await rerollMessage(s.actor, s.origin());
  assert.equal(getActiveWeaponEffects(s.target).length, 0);
  assert.equal(s.target.flags.cypher.activeWeaponEffects[0].combatRound, 2);
});

test("a missed attack rerolled after its interval cannot revive expired effects", async () => {
  for (const combat of [null, { id: "combat", round: 2 }]) {
    const s = scenario();
    game.combat = combat;
    await s.attack({ weaponTargetEffects: [hinder, { effect: "loseNextAction", duration: "next action" }] });
    await expireWeaponEffectsAfterAction(s.target);
    if (combat) game.combat.round = 3;
    await rerollMessage(s.actor, s.origin());
    assert.equal(getActiveWeaponEffects(s.target).length, 0);
    assert.equal(s.target.system.health.value, 16);
  }
});

test("partial target writes leave a durable checkpoint and never apply damage twice", async () => {
  const s = scenario([4, 20, 20]);
  await s.attack({ effortLevels: 1, weaponTargetEffects: [hinder] });
  const update = s.target.update;
  s.target.update = async function(changes, options) {
    if (Object.hasOwn(changes, "flags.cypher.activeWeaponEffects")) throw Error("effect write failed");
    return update.call(this, changes, options);
  };
  await assert.rejects(rerollMessage(s.actor, s.origin()), /effect write failed/);
  assert.equal(s.target.system.health.value, 12);
  assert.equal(s.origin().flags.cypher.attackConsequences.state, "pending");
  s.target.update = update;
  const metadata = await rerollMessage(s.actor, s.origin());
  assert.equal(metadata.attackConsequences.reason, "partial");
  assert.equal(s.target.system.health.value, 12);
  assert.equal(s.actor.system.stats.might.pool.value, 7);
});

test("a failed final chat write cannot refund the natural-20 cost twice", async () => {
  const s = scenario([4, 20, 20]);
  await s.attack({ effortLevels: 1 });
  const update = s.origin().update;
  s.origin().update = async function(changes) {
    if (changes["flags.cypher"].attackConsequences.state !== "pending") throw Error("chat write failed");
    return update.call(this, changes);
  };
  await assert.rejects(rerollMessage(s.actor, s.origin()), /chat write failed/);
  assert.equal(s.actor.system.stats.might.pool.value, 10);
  await s.actor.update({ "system.stats.might.pool.value": 6 });
  s.origin().update = update;
  await rerollMessage(s.actor, s.origin());
  assert.equal(s.actor.system.stats.might.pool.value, 6);
  assert.equal(s.target.system.health.value, 12);
});

test("an attack without a target still checkpoints its one-time natural-20 refund", async () => {
  const s = scenario([4, 20, 20, 20]);
  await s.attack({ targetActor: null, effortLevels: 1 });
  const update = s.origin().update;
  s.origin().update = async function(changes) {
    if (!changes["flags.cypher"].attackRefundPending) throw Error("final write failed");
    return update.call(this, changes);
  };
  await assert.rejects(rerollMessage(s.actor, s.origin()), /final write failed/);
  await s.actor.update({ "system.stats.might.pool.value": 6 });
  s.origin().update = update;
  await rerollMessage(s.actor, s.origin());
  await rerollMessage(s.actor, s.origin());
  assert.equal(s.actor.system.stats.might.pool.value, 6);
  assert.equal(s.origin().flags.cypher.attackRefundPending, true);
});

test("targetless successful refunds do not fabricate target history or manual warnings", async () => {
  const s = scenario([4, 20, 12]);
  await s.attack({ targetActor: null, effortLevels: 1 });
  await rerollMessage(s.actor, s.origin());
  await rerollMessage(s.actor, s.origin());
  assert.equal(s.origin().flags.cypher.attackConsequences, undefined);
  assert.equal(s.actor.system.stats.might.pool.value, 10);
  assert.deepEqual(s.warnings, []);
});

test("malformed effect intervals reject automatic corrections before target writes", async () => {
  const s = scenario();
  await s.attack({ weaponTargetEffects: [hinder] });
  delete s.origin().flags.cypher.attackConsequences.effectContext;
  const metadata = await rerollMessage(s.actor, s.origin());
  assert.equal(metadata.attackConsequences.state, "manual");
  assert.equal(s.target.system.health.value, 20);
});
