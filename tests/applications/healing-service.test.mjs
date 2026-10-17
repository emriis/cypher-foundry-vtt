import assert from "node:assert/strict";
import test from "node:test";
import { treatWound, useHealingHand } from "../../module/applications/healing-service.mjs";
import { rollRecovery } from "../../module/applications/recovery-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";

globalThis.game = { i18n: { localize: key => key, format: key => key } };
globalThis.ui = { notifications: { warn() {}, error() {} } };
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };

let actorSequence = 0;
const published = [];
function pc() {
  const id = `healing-${++actorSequence}`;
  const actor = { id, uuid: `Actor.${id}`, type: "pc", name: "Test healer", isOwner: true, flags: { cypher: {} }, items: new Map(), updates: [],
    system: { tier: 1, effort: 1, xp: 0, stats: Object.fromEntries(["might", "speed", "intellect"].map(stat =>
      [stat, { pool: { value: 10, max: 10 }, edge: 0 }])), recoveries: {},
    wounds: { minor: { current: 0, max: 3 }, moderate: { current: 2, max: 3 }, major: { current: 1, max: 3 } } },
    async update(changes) {
      this.updates.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split("."); let cursor = this;
        for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
        cursor[parts.at(-1)] = value;
      }
    } };
  return actor;
}
function hand(actor) { return { type: "ability", parent: actor, actor, system: { key: "healing-hand" } }; }
function dice(total) {
  globalThis.Roll = class { async evaluate() { this.total = total; return this; } async toMessage(message) { published.push(message); } };
}

test("a Healing Hand target write failure retains its committed cost, posts no success and releases both owners", async () => {
  const healer = pc(), target = pc();
  const update = target.update, chat = globalThis.ChatMessage;
  const cards = [];
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async card => { cards.push(card); } };
  try {
    target.update = async () => { throw new Error("target write failed"); };
    await assert.rejects(useHealingHand(hand(healer), { target, severity: "moderate", touchConfirmed: true }), /target write failed/);
    assert.equal(healer.system.stats.intellect.pool.value, 9);
    assert.equal(healer.flags.cypher.healingUses["healing-hand"], 1);
    assert.equal(target.system.wounds.moderate.current, 2);
    assert.deepEqual(cards, []);
    target.update = update;
    assert.equal((await useHealingHand(hand(healer), { target, severity: "moderate", touchConfirmed: true })).cost, 2);
    assert.equal(healer.system.stats.intellect.pool.value, 7);
    assert.equal(cards.length, 1);
  } finally { target.update = update; globalThis.ChatMessage = chat; }
});

test("Given Healing Hand on oneself, then one update reduces severity and charges the escalating Intellect cost", async () => {
  const actor = pc(); const ability = hand(actor);
  assert.equal((await useHealingHand(ability, { severity: "moderate", touchConfirmed: true })).cost, 1);
  assert.equal(actor.system.wounds.moderate.current, 1);
  assert.equal(actor.system.wounds.minor.current, 1);
  assert.equal(actor.updates.length, 1);
  assert.equal((await useHealingHand(ability, { severity: "moderate", touchConfirmed: true })).cost, 2);
  dice(4);
  await rollRecovery(actor, "action");
  assert.equal((await useHealingHand(ability, { severity: "minor", touchConfirmed: true })).cost, 1);
});

test("Given a full lower wound track or rejected contact, then Healing Hand charges nothing", async () => {
  const actor = pc(); actor.system.wounds.minor.current = 3;
  assert.equal(await useHealingHand(hand(actor), { severity: "moderate", touchConfirmed: true }), null);
  actor.system.wounds.minor.current = 0;
  assert.equal(await useHealingHand(hand(actor), { severity: "moderate", touchConfirmed: "false" }), null);
  assert.equal(actor.updates.length, 0);
});

test("Given an NPC target, then Healing Hand restores five Health up to its maximum", async () => {
  const actor = pc(); const npc = pc(); npc.type = "npc"; npc.system.health = { value: 7, max: 10 };
  await useHealingHand(hand(actor), { target: npc, touchConfirmed: true });
  assert.equal(npc.system.health.value, 10);
  assert.equal(actor.system.stats.intellect.pool.value, 9);
  assert.equal(await useHealingHand(hand(actor), { target: npc, touchConfirmed: true }), null);
});

test("Given a synthetic target, then healing updates it while its world Actor stays untouched", async () => {
  const healer = pc(); const target = pc(); const world = pc(); target.isToken = true; target.worldActor = world;
  await useHealingHand(hand(healer), { target, severity: "major", touchConfirmed: true });
  assert.equal(target.system.wounds.major.current, 0);
  assert.equal(world.system.wounds.major.current, 1);
  assert.equal(world.updates.length, 0);
});

test("Given insufficient Intellect or target permission, then Healing Hand changes neither Actor", async () => {
  const healer = pc(); const target = pc(); healer.system.stats.intellect.pool.value = 0;
  assert.equal(await useHealingHand(hand(healer), { target, severity: "major", touchConfirmed: true }), null);
  healer.system.stats.intellect.pool.value = 10; target.isOwner = false;
  assert.equal(await useHealingHand(hand(healer), { target, severity: "major", touchConfirmed: true }), null);
  assert.equal(healer.updates.length, 0); assert.equal(target.updates.length, 0);
});

test("Given completed treatment, then its Intellect task removes one wound only on success", async () => {
  const healer = pc(); const target = pc(); dice(20);
  const success = await treatWound(healer, { target, severity: "moderate", completed: true });
  assert.equal(success.success, true);
  assert.equal(target.system.wounds.moderate.current, 1);
  assert.equal(healer.system.stats.might.pool.value, 10);
  dice(2);
  const failure = await treatWound(healer, { target, severity: "moderate", completed: true });
  assert.equal(failure.success, false);
  assert.equal(target.system.wounds.moderate.current, 1);
});

test("Given unconfirmed treatment duration, then an arbitrary truthy string cannot consent to healing", async () => {
  const healer = pc(); const target = pc(); dice(20);
  assert.equal(await treatWound(healer, { target, severity: "moderate", completed: "false" }), null);
  assert.equal(target.updates.length, 0);
});

test("Given a failed treatment, then a successful paid reroll heals exactly once", async () => {
  const healer = pc(); const target = pc(); healer.system.xp = 3;
  globalThis.fromUuid = async uuid => uuid === target.uuid ? target : healer;
  dice(2);
  await treatWound(healer, { target, severity: "moderate", completed: true });
  const data = published.at(-1);
  const message = { flags: data.flags, getFlag(_scope, key) { return this.flags.cypher[key]; },
    async update(changes) { this.flags.cypher = changes["flags.cypher"]; } };
  dice(20);
  await rerollMessage(healer, message);
  assert.equal(target.system.wounds.moderate.current, 1);
  await rerollMessage(healer, message);
  assert.equal(target.system.wounds.moderate.current, 1);
});

test("Given a healed wound removes hindrance, then the persisted hindered token status is cleared", async () => {
  const actor = pc(); actor.system.wounds.major.current = 0;
  actor.system.wounds.moderate.max = 2;
  actor.system.hindered = true; actor.statuses = new Set(["hindered"]);
  actor.toggleStatusEffect = async (id, { active }) => active ? actor.statuses.add(id) : actor.statuses.delete(id);
  const update = actor.update.bind(actor);
  actor.update = async changes => {
    await update(changes);
    actor.system.hindered = actor.system.wounds.moderate.current >= actor.system.wounds.moderate.max;
  };
  await useHealingHand(hand(actor), { severity: "moderate", touchConfirmed: true });
  assert.equal(actor.statuses.has("hindered"), false);
});
