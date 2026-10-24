/** CRD shield exceptions: real services, persisted patches and deterministic dice. */
import test from "node:test";
import assert from "node:assert/strict";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
import { designateShield, startShieldWork, finishShieldWork, retrieveShield,
  skipUnyieldingShieldTurn, resolveShieldTurnLoss } from "../../module/applications/shield-lifecycle-service.mjs";
import { executeShieldAbility } from "../../module/applications/shield-attack-service.mjs";
import { shieldAbsorbWound } from "../../module/applications/damage-service.mjs";
import { canShieldAbsorbWound } from "../../module/rules/wounds.mjs";
import { rollTask } from "../../module/applications/task-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
import { rollRecovery } from "../../module/applications/recovery-service.mjs";

function scenario(key = "throw-shield", dice = [12, 12]) {
  const messages = new Map(), writes = [], rolled = [];
  let serial = 0;
  const document = data => {
    const result = { id: `message-${serial++}`, isOwner: true, ...data,
      getFlag(namespace, key) { return this.flags?.[namespace]?.[key]; },
      async update(changes) { applyDocumentUpdate(this, changes); } };
    messages.set(result.id, result);
    return result;
  };
  globalThis.game = { messages, time: { worldTime: 0 }, user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } },
    i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.foundry = { utils: { escapeHTML: value => value, randomID: () => `flight-${serial++}` } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => document(data) };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { this.total = dice.shift(); rolled.push(this.total); return this; }
    async toMessage(data) { return document(data); }
  };
  const actor = { id: "pc", uuid: "Scene.s.Token.t.Actor.pc", type: "pc", isOwner: true, flags: {}, items: new Map(), statuses: new Set(),
    system: { tier: 1, xp: 5, effort: 3, armor: {}, hinderSteps: 0, recoveries: {},
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 20, max: 20 }, edge: 0 }])),
      wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(changes) { writes.push(changes); applyDocumentUpdate(this, changes); },
    async toggleStatusEffect() {},
    rollTask(options) { return rollTask(this, options); },
    async createEmbeddedDocuments(type, data) {
      return data.map(entry => {
        const created = makeShield(`new-${serial++}`);
        created.name = entry.name;
        Object.assign(created.system, entry.system);
        actor.items.set(created.id, created);
        return created;
      });
    }
  };
  const makeShield = id => ({ id, actor, parent: actor, name: "Shield", type: "shield", isOwner: true,
    system: { equipped: true, inHand: true, abilityItemId: "", repairReadyAt: null, replacementReadyAt: null,
      wounds: { minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 1 } } },
    async update(changes) { writes.push(changes); applyDocumentUpdate(this, changes); } });
  const shield = makeShield("shield"), ordinary = makeShield("ordinary");
  const ability = { id: "ability", actor, parent: actor, type: "ability", name: "Localized", isOwner: true,
    system: { key, cost: { stat: key === "bouncing-shield" ? "speed" : "none", amount: key === "bouncing-shield" ? 3 : 0 } } };
  for (const item of [shield, ordinary, ability]) actor.items.set(item.id, item);
  const target = id => ({ id, uuid: `Scene.s.Token.${id}.Actor.npc`, type: "npc", isOwner: true, flags: {},
    system: { level: 3, armor: 0, health: { value: 20, max: 20 } },
    async update(changes) { applyDocumentUpdate(this, changes); } });
  const targets = [target("a"), target("b"), target("c")];
  globalThis.fromUuid = async uuid => [actor, ...targets].find(value => value.uuid === uuid) ?? null;
  const options = { shieldId: shield.id, targets: [targets[0]], rangeConfirmed: true, catchOptions: {} };
  const tasks = () => [...messages.values()].filter(message => message.flags?.cypher?.rollType === "task");
  return { actor, ability, shield, ordinary, targets, options, tasks, messages, writes, rolled };
}

test("designation creates at most one shield and never grants an exception to other inventory", async () => {
  const s = scenario("unyielding-shield");
  const created = await designateShield(s.ability);
  assert.equal(await designateShield(s.ability), created);
  assert.equal(s.actor.items.size, 4);
  assert.equal(created.system.abilityItemId, s.ability.id);
  assert.equal(s.ordinary.system.abilityItemId, "");
});

test("Unyielding Shield survives repeated major wounds while an ordinary shield breaks", async () => {
  const s = scenario("unyielding-shield");
  await designateShield(s.ability, s.shield.id);
  await shieldAbsorbWound(s.actor, s.shield, "major");
  assert.equal(canShieldAbsorbWound(s.shield), true);
  assert.equal(s.shield.system.wounds.major.current, 1);
  assert.equal(s.actor.flags.cypher.shieldTurnLossPending, true);
  await shieldAbsorbWound(s.actor, s.shield, "major");
  await shieldAbsorbWound(s.actor, s.ordinary, "major");
  assert.equal(canShieldAbsorbWound(s.ordinary), false);
  s.actor.items.delete(s.ability.id);
  assert.equal(canShieldAbsorbWound(s.shield), false);
});

test("completed recovery clears only designated minor/moderate wounds, never its major or other shields", async () => {
  const s = scenario("unyielding-shield", [4, 4]);
  await designateShield(s.ability, s.shield.id);
  for (const item of [s.shield, s.ordinary]) for (const severity of ["minor", "moderate", "major"]) item.system.wounds[severity].current = 1;
  assert.equal(await rollRecovery(s.actor, "action", { allocate: () => null }), null);
  assert.equal(s.shield.system.wounds.minor.current, 1);
  assert.ok(await rollRecovery(s.actor, "action"));
  assert.deepEqual(Object.values(s.shield.system.wounds).map(w => w.current), [0, 0, 1]);
  assert.deepEqual(Object.values(s.ordinary.system.wounds).map(w => w.current), [1, 1, 1]);
});

test("Hidden Shield repair needs confirmed resources, elapsed day and completed work", async () => {
  const s = scenario("hidden-shield");
  await designateShield(s.ability, s.shield.id);
  await shieldAbsorbWound(s.actor, s.shield, "major");
  assert.equal(await startShieldWork(s.shield), false);
  assert.equal(await startShieldWork(s.shield, { resourcesConfirmed: true }), true);
  assert.equal(await startShieldWork(s.shield, { resourcesConfirmed: true }), false);
  assert.equal(await finishShieldWork(s.shield, { workCompleted: true }), false);
  game.time.worldTime = 86400;
  assert.equal(await finishShieldWork(s.shield), false);
  assert.equal(await finishShieldWork(s.shield, { workCompleted: true }), true);
  assert.equal(s.shield.system.wounds.major.current, 0);
  assert.equal(s.shield.system.equipped, false);
  assert.equal(await finishShieldWork(s.shield, { workCompleted: true }), false);
});

test("Unyielding replacement rolls its work duration and invalidates the lost shield's flight", async () => {
  const s = scenario("unyielding-shield", [4]);
  await designateShield(s.ability, s.shield.id);
  s.shield.system.inHand = false;
  s.shield.system.flightId = "old-flight";
  await startShieldWork(s.shield, { resourcesConfirmed: true });
  assert.equal(s.shield.system.replacementReadyAt, 4 * 86400);
  game.time.worldTime = 4 * 86400;
  assert.equal(await finishShieldWork(s.shield, { workCompleted: true }), true);
  assert.equal(s.shield.system.inHand, true);
  assert.equal(s.shield.system.flightId, "");
});

test("a missed throw still makes its catch task; failed catch blocks further shield use until retrieval", async () => {
  const s = scenario("throw-shield", [4, 4]);
  const result = await executeShieldAbility(s.ability, s.options);
  assert.equal(result.results[0].success, false);
  assert.equal(result.caught.success, false);
  assert.equal(s.shield.system.inHand, false);
  assert.equal(canShieldAbsorbWound(s.shield), false);
  assert.equal(await executeShieldAbility(s.ability, s.options), null);
  assert.equal(await retrieveShield(s.shield), true);
  assert.equal(s.shield.system.equipped, false);
});

test("a successful paid catch reroll retrieves only its own flight and retains original Effort expenditure", async () => {
  const s = scenario("throw-shield", [12, 2, 12]); // With Effort, difficulty 1 requires 3.
  await executeShieldAbility(s.ability, { ...s.options, catchOptions: { effortLevels: 1 } });
  const origin = s.tasks().at(-1);
  assert.equal(s.shield.system.inHand, false);
  assert.equal(s.actor.system.stats.speed.pool.value, 17);
  await rerollMessage(s.actor, origin);
  assert.equal(s.shield.system.inHand, true);
  assert.equal(s.shield.system.equipped, true);
  assert.equal(s.actor.system.xp, 4);
  assert.equal(s.actor.system.stats.speed.pool.value, 17);
});

test("an old catch reroll cannot retrieve a shield from a newer flight", async () => {
  const s = scenario("throw-shield", [12, 4, 12]);
  await executeShieldAbility(s.ability, s.options);
  const origin = s.tasks().at(-1);
  s.shield.system.flightId = "new-flight";
  await rerollMessage(s.actor, origin);
  assert.equal(s.shield.system.inHand, false);
});

test("Bouncing Shield attacks ordered targets, including first again, and pays activation once", async () => {
  const s = scenario("bouncing-shield", [12, 12, 12, 12]);
  s.actor.system.stats.speed.edge = 1;
  const result = await executeShieldAbility(s.ability, { ...s.options,
    targets: [s.targets[0], s.targets[1], s.targets[0]], rollOptions: { effectEffortLevels: 1 } });
  assert.equal(result.results.length, 3);
  assert.equal(result.caught.success, true);
  assert.equal(s.actor.system.stats.speed.pool.value, 11); // 5 + 2 + 2, once-only activation.
  assert.equal(s.targets[0].system.health.value, 16);
  assert.equal(s.targets[1].system.health.value, 18);
  assert.equal(s.targets[0].flags.cypher.activeWeaponEffects[0].hinderSteps, 1);
  assert.equal(s.targets[0].flags.cypher.activeWeaponEffects.length, 1);
  assert.equal(s.shield.system.inHand, true);
});

test("invalid targets, missing range and insufficient activation reject without spending or throwing", async () => {
  const s = scenario("bouncing-shield");
  assert.equal(await executeShieldAbility(s.ability, { ...s.options, targets: [s.targets[0], s.targets[0], s.targets[1]] }), null);
  assert.equal(await executeShieldAbility(s.ability, { ...s.options, rangeConfirmed: false }), null);
  s.actor.system.stats.speed.pool.value = 2;
  assert.equal(await executeShieldAbility(s.ability, { ...s.options, targets: s.targets }), null);
  assert.equal(s.writes.length, 0);
  assert.equal(s.rolled.length, 0);
});

test("Hidden Shield hinders both the main melee attack and its extra shield attack", async () => {
  const s = scenario("hidden-shield", [12, 12]);
  await designateShield(s.ability, s.shield.id);
  s.ordinary.system.equipped = false;
  const main = { id: "main", type: "attack", flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 1 } } }, actor: s.actor,
    system: { stat: "might", attackType: "medium", damage: 4, freelyUsable: true, range: "immediate" } };
  s.actor.items.set(main.id, main);
  await executeShieldAbility(s.ability, { ...s.options, mode: "paired", mainAttackId: main.id,
    targets: [s.targets[0], s.targets[0]] });
  assert.deepEqual(s.tasks().map(m => m.flags.cypher.effectiveDifficulty), [4, 3]);
  assert.equal(s.targets[0].system.health.value, 14);
  assert.equal(s.shield.system.inHand, true);
});

test("automatic lost-turn resolution belongs to the active GM and allows the intrusion alternative", async () => {
  const s = scenario("unyielding-shield");
  s.actor.flags.cypher = { shieldTurnLossPending: true };
  let advanced = 0;
  const combat = { started: true, combatant: { actor: s.actor }, async nextTurn() { advanced++; } };
  await skipUnyieldingShieldTurn(combat, { turn: 1 }, { direction: -1 }, "gm");
  assert.equal(advanced, 0);
  await skipUnyieldingShieldTurn(combat, { turn: 1 }, { direction: 1 }, "gm");
  assert.equal(advanced, 1);
  assert.equal(s.actor.flags.cypher.shieldTurnLossPending, false);
  s.actor.flags.cypher.shieldTurnLossPending = true;
  game.user.isGM = false;
  assert.equal(await resolveShieldTurnLoss(s.actor, { gmIntrusion: true }), false);
  assert.equal(s.actor.flags.cypher.shieldTurnLossPending, true);
  game.user.isGM = true;
  assert.equal(await resolveShieldTurnLoss(s.actor, { gmIntrusion: true }), true);
});

test("Bouncing Shield's initial natural 20 refunds activation and Effort exactly once", async () => {
  const s = scenario("bouncing-shield", [20, 12, 12, 12, 20]);
  s.actor.system.stats.speed.edge = 1;
  await executeShieldAbility(s.ability, { ...s.options, targets: s.targets, rollOptions: { effectEffortLevels: 1 } });
  assert.equal(s.actor.system.stats.speed.pool.value, 16);
  const first = s.tasks()[0];
  assert.equal(first.flags.cypher.effortCost, 5);
  assert.equal(first.flags.cypher.costRefunded, true);
  await rerollMessage(s.actor, first);
  assert.equal(s.actor.system.stats.speed.pool.value, 16);
  assert.equal(s.actor.system.xp, 4);
});

test("Shield Master delays overflow on the designated Unyielding shield without preventing the turn penalty", async () => {
  const s = scenario("unyielding-shield");
  await designateShield(s.ability, s.shield.id);
  s.actor.items.set("master", { id: "master", type: "ability", system: { passiveModifiers: [
    { kind: "shieldWoundCapacity", severity: "moderate", amount: 1 }
  ] } });
  s.shield.system.wounds.minor.current = 3;
  s.shield.system.wounds.moderate.current = 2;
  await shieldAbsorbWound(s.actor, s.shield, "minor");
  assert.equal(s.shield.system.wounds.moderate.current, 3);
  assert.equal(s.actor.flags.cypher?.shieldTurnLossPending, undefined);
  await shieldAbsorbWound(s.actor, s.shield, "minor");
  assert.equal(s.actor.flags.cypher.shieldTurnLossPending, true);
  assert.equal(canShieldAbsorbWound(s.shield), true);
});

test("stopping later attacks preserves the completed attack and still offers its catch", async () => {
  const s = scenario("bouncing-shield", [12, 12]);
  const result = await executeShieldAbility(s.ability, { ...s.options, targets: s.targets, chooseAttackOptions: () => null });
  assert.equal(result.completed, false);
  assert.equal(result.results.length, 1);
  assert.equal(s.targets[0].system.health.value, 18);
  assert.equal(s.targets[1].system.health.value, 20);
  assert.equal(s.actor.system.stats.speed.pool.value, 17);
  assert.equal(s.shield.system.inHand, true);
});

test("unowned shields and stale special designations reject before dice or Pool changes", async () => {
  const s = scenario("hidden-shield");
  assert.equal(await executeShieldAbility(s.ability, { ...s.options, mode: "melee" }), null);
  s.shield.isOwner = false;
  assert.equal(await designateShield(s.ability, s.shield.id), null);
  assert.equal(await startShieldWork(s.shield, { resourcesConfirmed: true }), false);
  assert.equal(s.writes.length, 0);
  assert.equal(s.rolled.length, 0);
});

test("Hidden Shield's extra melee attack may follow a ranged main attack", async () => {
  const s = scenario("hidden-shield", [12, 12]);
  await designateShield(s.ability, s.shield.id);
  s.ordinary.system.equipped = false;
  const main = { id: "ranged", type: "attack", flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 1 } } }, actor: s.actor, system: {
    stat: "speed", attackType: "medium", damage: 4, freelyUsable: true, range: "short"
  } };
  s.actor.items.set(main.id, main);
  const result = await executeShieldAbility(s.ability, { ...s.options, mode: "paired", mainAttackId: main.id,
    targets: [s.targets[0], s.targets[1]] });
  assert.equal(result.results.length, 2);
  assert.deepEqual(s.tasks().map(message => message.flags.cypher.effectiveDifficulty), [4, 3]);
});

test("a catch API cannot substitute a routine Might task for the required Speed task", async () => {
  const s = scenario();
  s.shield.system.inHand = false;
  s.shield.system.flightId = "flight";
  const before = s.actor.system.stats.might.pool.value;
  assert.equal(await rollTask(s.actor, { stat: "might", difficulty: 0, effortLevels: 1,
    shieldReturn: { itemId: s.shield.id, flightId: "flight" }, abilitySource: { itemId: s.ability.id } }), null);
  assert.equal(s.shield.system.inHand, false);
  assert.equal(s.actor.system.stats.might.pool.value, before);
  assert.equal(s.rolled.length, 0);
});

test("a later target write failure retains earlier attacks and releases the owner's action guard", async () => {
  const s = scenario("bouncing-shield", [12, 12]);
  s.targets[1].update = async () => { throw new Error("target write failed"); };
  await assert.rejects(executeShieldAbility(s.ability, { ...s.options, targets: s.targets }), /target write failed/);
  assert.equal(s.targets[0].system.health.value, 18);
  assert.equal(s.actor.system.stats.speed.pool.value, 17);
  assert.equal(s.shield.system.inHand, false);
  assert.equal(await retrieveShield(s.shield), true);
});

test("two clicks cannot start overlapping throws on the same actual defender", async () => {
  const s = scenario("bouncing-shield", [12, 12]);
  let release;
  const accepted = new Promise(resolve => { release = resolve; });
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const first = executeShieldAbility(s.ability, { ...s.options, targets: s.targets,
    chooseAttackOptions: async () => { entered(); await accepted; return null; } });
  await waiting;
  assert.equal(await executeShieldAbility(s.ability, { ...s.options, targets: s.targets }), null);
  release();
  await first;
  assert.equal(s.actor.system.stats.speed.pool.value, 17);
  assert.equal(s.targets[0].system.health.value, 18);
});

test("an interrupted natural-20 catch reroll cannot refund its original cost twice", async () => {
  const s = scenario("throw-shield", [12, 2, 20, 20]);
  await executeShieldAbility(s.ability, { ...s.options, catchOptions: { effortLevels: 1 } });
  assert.equal(s.shield.system.inHand, false);
  const origin = s.tasks().at(-1), update = origin.update.bind(origin);
  let failed = false;
  origin.update = async changes => {
    if (!failed && changes["flags.cypher"].shieldReturn?.state !== "pending") {
      failed = true;
      throw new Error("origin write failed");
    }
    await update(changes);
  };
  await assert.rejects(rerollMessage(s.actor, origin), /origin write failed/);
  assert.equal(s.actor.system.stats.speed.pool.value, 20);
  await s.actor.update({ "system.stats.speed.pool.value": 17 });
  await rerollMessage(s.actor, origin);
  assert.equal(s.actor.system.stats.speed.pool.value, 17);
  assert.equal(s.actor.system.xp, 3);
  assert.equal(origin.flags.cypher.shieldReturn.reason, "partial");
});
