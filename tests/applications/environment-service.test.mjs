/** Real task/consequence integration with deterministic dice and Foundry-style flag merges. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { declareEnvironmentalExposure, resolveEnvironmentalExposure, endEnvironmentalExposure, getEnvironmentalExposures } from "../../module/applications/environment-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
import { stampDefenseRevisions } from "../../module/applications/defense-history.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";

let pc, gm, die, rolls, messages, registry, counter;
beforeEach(() => {
  gm = { id: "gm", isGM: true }; die = 1; rolls = 0; messages = []; registry = new Map(); counter = 0;
  globalThis.game = { user: gm, users: { activeGM: gm }, time: { worldTime: 100 },
    i18n: { localize: key => key, format: key => key }, messages: { get: id => messages.find(message => message.id === id) } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.foundry = { utils: { randomID: () => `id-${++counter}`, escapeHTML: text => String(text).replaceAll("<", "&lt;") } };
  globalThis.fromUuid = async uuid => registry.get(uuid);
  const create = async data => {
    const message = { ...data, id: `message-${messages.length}`, isOwner: true,
      getFlag: (scope, key) => message.flags?.[scope]?.[key],
      async update(patch) { applyDocumentUpdate(this, patch); } };
    messages.push(message); return message;
  };
  globalThis.ChatMessage = { create, getSpeaker: () => ({}) };
  globalThis.Roll = class {
    constructor() { this.total = die; }
    async evaluate() { rolls++; return this; }
    async toMessage(data) { return create(data); }
  };
  pc = { id: "pc", uuid: "Actor.pc", type: "pc", name: "PC", isOwner: true, flags: {}, items: new Map(), statuses: new Set(), updates: [],
    system: { xp: 5, effort: 3, armor: {},
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 10, max: 10 }, edge: 0 }])),
      wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(patch, options = {}) { this.updates.push(patch); stampDefenseRevisions(this, patch, options); applyDocumentUpdate(this, patch); },
    async toggleStatusEffect() {} };
  registry.set(pc.uuid, pc);
});

const immediate = { name: "Declared fall", mode: "immediate", severity: "moderate", conditions: [{ kind: "prone" }] };
const defense = { name: "Smoke", mode: "defense", stat: "might", difficulty: 3, severity: "moderate",
  poolDamage: { stat: "speed", amount: 2 }, conditions: [{ kind: "dazed" }], noPhysicalMovement: true };
const resolve = (entry, options = {}) => resolveEnvironmentalExposure(pc, entry.id, { expectedSequence: entry.sequence, ...options });

test("GM declarations do not apply damage; immediate effects apply once without dice, action or shield", async () => {
  pc.flags.cypher = { roundActionUsage: { primary: true } };
  const entry = await declareEnvironmentalExposure(pc, immediate);
  assert.equal(pc.system.wounds.moderate.current, 0);
  await Promise.all([resolve(entry), resolve(entry)]);
  assert.equal(pc.system.wounds.moderate.current, 1);
  assert.equal(rolls, 0); assert.equal(pc.system.stats.might.pool.value, 10);
  assert.deepEqual(pc.flags.cypher.roundActionUsage, { primary: true });
  assert.equal(pc.flags.cypher.generalEffects[0].kind, "prone");
  assert.equal(getEnvironmentalExposures(pc)[0].state, "completed");
  assert.equal(await resolve(entry), null);
  assert.equal(messages[0].flags.cypher.rerollable, false);
});

test("environmental defense rerolls remove only their effects and preserve later damage and Effort costs", async () => {
  const entry = await declareEnvironmentalExposure(pc, defense);
  await resolve(entry, { effortLevels: 1 });
  const card = messages[0];
  assert.equal(pc.system.wounds.moderate.current, 1);
  assert.equal(pc.system.stats.might.pool.value, 7);
  assert.equal(pc.system.stats.speed.pool.value, 8);
  assert.equal(card.flags.cypher.environmentalSource.name, "Smoke");
  await pc.update({ "system.wounds.minor.current": 1 });
  die = 12;
  await rerollMessage(pc, card);
  assert.equal(pc.system.wounds.moderate.current, 0);
  assert.equal(pc.system.wounds.minor.current, 1);
  assert.equal(pc.system.stats.speed.pool.value, 10);
  assert.equal(pc.system.stats.might.pool.value, 7);
  assert.equal(pc.system.xp, 4);
  assert.equal(pc.flags.cypher.generalEffects.length, 0);
});

test("saved repeated exposures require elapsed time and cannot reuse a stale occurrence", async () => {
  const entry = await declareEnvironmentalExposure(pc, { ...immediate, conditions: [], severity: "minor", intervalSeconds: 60 });
  await resolve(entry);
  pc.flags = structuredClone(pc.flags); // Saved state after a client reload.
  const next = getEnvironmentalExposures(pc)[0];
  assert.equal(next.sequence, 1); assert.equal(next.nextAt, 160);
  assert.equal(await resolve(next), null);
  game.time.worldTime = 160;
  await resolve(next);
  assert.equal(await resolve(next, { intervalPassed: true }), null);
  assert.equal(pc.system.wounds.minor.current, 2);
  assert.equal(await endEnvironmentalExposure(pc, entry.id), true);
  assert.equal(await resolve(getEnvironmentalExposures(pc)[0], { intervalPassed: true }), null);
  assert.equal(pc.system.wounds.minor.current, 2);
});

test("protection is explicit and cannot be bypassed by roll options overriding the frozen profile", async () => {
  const entry = await declareEnvironmentalExposure(pc, { ...defense, protection: { source: "Declared suit", woundReduction: 1, poolReduction: 1 } });
  await resolve(entry, { incomingSeverity: "major", incomingPoolDamage: { stat: "might", amount: 100 }, difficulty: 0 });
  assert.equal(pc.system.wounds.minor.current, 1);
  assert.equal(pc.system.wounds.major.current, 0);
  assert.equal(pc.system.stats.speed.pool.value, 9);
  assert.equal(messages[0].flags.cypher.incomingSeverity, "minor");
  const immune = await declareEnvironmentalExposure(pc, { ...defense, protection: { source: "Explicit immunity", immune: true } });
  const result = await resolve(immune, { effortLevels: 1 });
  assert.equal(result.protected, true); assert.equal(rolls, 1);
  assert.equal(pc.system.stats.might.pool.value, 10);
});

test("only the elected GM declares or triggers hazards, with validation before writes", async () => {
  game.user = { id: "player", isGM: false };
  assert.equal(await declareEnvironmentalExposure(pc, immediate), null);
  game.user = { id: "gm2", isGM: true };
  assert.equal(await declareEnvironmentalExposure(pc, immediate), null);
  game.user = gm;
  assert.equal(await declareEnvironmentalExposure(pc, { ...immediate, wounds: -1 }), null);
  assert.equal(pc.updates.length, 0);
  const entry = await declareEnvironmentalExposure(pc, immediate);
  game.user = { id: "player", isGM: false };
  assert.equal(await resolve(entry), null);
  game.user = gm; pc.isOwner = false;
  assert.equal(await resolve(entry), null);
  assert.equal(pc.system.wounds.moderate.current, 0);
});

test("a partially applied exposure is blocked for GM reconciliation instead of replayed", async () => {
  const entry = await declareEnvironmentalExposure(pc, immediate), create = ChatMessage.create;
  ChatMessage.create = async () => { throw Error("Chat unavailable"); };
  await assert.rejects(resolve(entry), /Chat unavailable/);
  assert.equal(pc.system.wounds.moderate.current, 1);
  assert.equal(getEnvironmentalExposures(pc)[0].state, "manual");
  ChatMessage.create = create;
  assert.equal(await resolve(entry, { intervalPassed: true }), null);
  assert.equal(pc.system.wounds.moderate.current, 1);
  assert.equal(await endEnvironmentalExposure(pc, entry.id), false);
  assert.equal(await endEnvironmentalExposure(pc, entry.id, { reconciled: true }), true);
});

test("synthetic Actors keep their own exposure and wounds without touching the world sibling", async () => {
  const sibling = pc;
  pc = { ...pc, uuid: "Scene.s.Token.t.Actor.pc", flags: {}, system: structuredClone(pc.system), updates: [] };
  registry.set(pc.uuid, pc);
  const entry = await declareEnvironmentalExposure(pc, immediate);
  await resolve(entry);
  assert.equal(pc.system.wounds.moderate.current, 1);
  assert.equal(sibling.system.wounds.moderate.current, 0);
  assert.equal(getEnvironmentalExposures(sibling).length, 0);
});

test("insufficient resources and invalid choices reject before the processing checkpoint", async () => {
  const entry = await declareEnvironmentalExposure(pc, defense);
  pc.system.stats.might.pool.value = 0;
  const count = pc.updates.length;
  assert.equal(await resolve(entry, { effortLevels: 1 }), null);
  assert.equal(pc.updates.length, count);
  assert.equal(getEnvironmentalExposures(pc)[0].state, "ready");
  assert.equal(await resolve(entry, { assetSteps: -1 }), null);
  assert.equal(pc.updates.length, count);
  assert.equal(rolls, 0);
});

test("a retained natural twenty refunds only the original action's cost, not reroll XP", async () => {
  const entry = await declareEnvironmentalExposure(pc, defense);
  await resolve(entry, { effortLevels: 1 });
  die = 20;
  await rerollMessage(pc, messages[0]);
  assert.equal(pc.system.stats.might.pool.value, 10);
  assert.equal(pc.system.xp, 4);
  assert.equal(pc.system.wounds.moderate.current, 0);
  assert.equal(pc.system.stats.speed.pool.value, 10);
});

test("defense-applied prone conditions are attributed and removed on a successful reroll", async () => {
  const entry = await declareEnvironmentalExposure(pc, { ...defense, conditions: [{ kind: "prone" }] });
  await resolve(entry);
  assert.equal(pc.flags.cypher.generalEffects[0].kind, "prone");
  die = 12; await rerollMessage(pc, messages[0]);
  assert.equal(pc.flags.cypher.generalEffects.length, 0);
});

test("a lost completion acknowledgement cannot repeat saved damage after reload", async () => {
  const entry = await declareEnvironmentalExposure(pc, immediate), update = pc.update;
  pc.update = async function(patch, options) {
    await update.call(this, patch, options);
    if (patch["flags.cypher.environmentalExposures"]?.some(record => record.state === "completed")) throw Error("Acknowledgement lost");
  };
  await assert.rejects(resolve(entry), /Acknowledgement lost/);
  pc.update = update; pc.flags = structuredClone(pc.flags);
  assert.equal(await resolve(entry), null);
  assert.equal(pc.system.wounds.moderate.current, 1);
});
