/** Exercise real general-rule services with persisted flags and fixed public dice outcomes. */
import assert from "node:assert/strict";
import test from "node:test";
import { rollTask } from "../../module/applications/task-service.mjs";
import { declareCooperation } from "../../module/applications/cooperative-service.mjs";
import { rollCooperativeAction, passGuard, resistSpecialDamage, repeatDiseaseExposure } from "../../module/applications/general-action-service.mjs";
import { getGeneralEffects, setGuarding, stampGeneralTurnRevision } from "../../module/applications/general-effect-service.mjs";
import { rollNpcAttack } from "../../module/applications/npc-combat-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
import { stampDefenseRevisions } from "../../module/applications/defense-history.mjs";
import { enforceSpecialDamageHealing } from "../../module/applications/special-damage-healing.mjs";
import { getRecoveryPools, rallyWound, rollRecovery } from "../../module/applications/recovery-service.mjs";
import { removeWound } from "../../module/applications/wound-removal.mjs";

let counter = 0, die = 1, rolls = 0, registry, messages;
function merge(target, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split(".");
    let cursor = target;
    for (const key of parts.slice(0, -1)) cursor = cursor[key] ??= {};
    const key = parts.at(-1);
    if (value && typeof value === "object" && !Array.isArray(value)) merge(cursor[key] ??= {}, value);
    else cursor[key] = structuredClone(value);
  }
}
function setup() {
  registry = new Map(); messages = []; rolls = 0; die = 1;
  globalThis.foundry = { utils: { randomID: () => `effect-${++counter}`, escapeHTML: text => text } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.game = { user: { isGM: true }, i18n: { localize: key => key, format: key => key }, messages: { get: id => messages.find(message => message.id === id) } };
  globalThis.fromUuid = async uuid => registry.get(uuid);
  const createMessage = async data => {
    const message = { ...data, id: `message-${messages.length}`, isOwner: true,
      getFlag: (scope, key) => message.flags?.[scope]?.[key], async update(patch) { merge(this, patch); } };
    messages.push(message);
    return message;
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: createMessage };
  globalThis.Roll = class {
    constructor() { this.total = die; }
    async evaluate() { rolls++; return this; }
    async toMessage(message) { return createMessage(message); }
  };
}
function actor(id, type = "pc") {
  const result = { id, uuid: `Actor.${id}`, type, isOwner: true, name: id,
    flags: { cypher: {} }, items: new Map(), statuses: new Set(), updates: [],
    system: { level: 3, xp: 5, effort: 3, armor: type === "pc" ? {} : 0, health: { value: 12, max: 12 },
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 10, max: 10 }, edge: 0 }])),
      wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(patch, options = {}) {
      if (enforceSpecialDamageHealing(this, patch, options) === false) return;
      this.updates.push(structuredClone(patch)); stampDefenseRevisions(this, patch, options); merge(this, patch);
    },
    async toggleStatusEffect() {} };
  registry.set(result.uuid, result);
  return result;
}
const claw = { damage: { mode: "wound", severity: "moderate", wounds: 1 } };

test("several helpers share the two-asset cap and accepted help is consumed once", async () => {
  setup(); const helper = actor("helper"), other = actor("other"), pc = actor("pc");
  helper.items.set("skill", { type: "skill", system: { stepModifier: 1 } });
  assert.equal(await declareCooperation(helper, pc, { kind: "help", skillItemId: "skill", taskLabel: "Climb" }), true);
  await declareCooperation(other, pc, { kind: "help", taskLabel: "Climb" });
  die = 9;
  const result = await rollTask(pc, { difficulty: 5, cooperativeMode: "help", assetSteps: 1 });
  assert.equal(result.effectiveDifficulty, 3);
  assert.equal(getGeneralEffects(pc).length, 0);
  const second = await rollTask(pc, { difficulty: 5, cooperativeMode: "help", effortLevels: 1 });
  assert.equal(second, null);
  assert.equal(pc.system.stats.might.pool.value, 10);
});

test("inability and permission rejections leave both helper and beneficiary unchanged", async () => {
  setup(); const helper = actor("helper"), pc = actor("pc");
  helper.items.set("skill", { type: "skill", system: { stepModifier: -1 } });
  assert.equal(await declareCooperation(helper, pc, { kind: "help", skillItemId: "skill", taskLabel: "Climb" }), false);
  pc.isOwner = false;
  assert.equal(await declareCooperation(helper, pc, { kind: "defenseHelp" }), false);
  assert.equal(pc.updates.length, 0);
});

test("defensive help remains for multiple defenses and ends at the helper's next turn", async () => {
  setup(); const helper = actor("helper"), pc = actor("pc"), npc = actor("npc", "npc");
  game.combat = { id: "combat", round: 1, turn: 0, turns: [{ id: "helper", actor: helper }, { id: "pc", actor: pc }] };
  await declareCooperation(helper, pc, { kind: "defenseHelp" });
  die = 20;
  assert.equal((await rollNpcAttack(npc, claw, { target: pc, cooperativeMode: "help" })).defense.effectiveDifficulty, 2);
  assert.equal((await rollNpcAttack(npc, claw, { target: pc, cooperativeMode: "help" })).defense.effectiveDifficulty, 2);
  game.combat.round = 2;
  game.combat.flags = { cypher: { turnRevisions: { helper: 1 } } };
  assert.equal(getGeneralEffects(pc).length, 0);
});

test("distraction is at most one step, and cannot be selected together with help", async () => {
  setup(); const helper = actor("helper"), other = actor("other"), pc = actor("pc"), npc = actor("npc", "npc");
  await declareCooperation(helper, npc, { kind: "distraction" });
  await declareCooperation(other, npc, { kind: "distraction" });
  const result = await rollNpcAttack(npc, claw, { target: pc, cooperativeMode: "distraction" });
  assert.equal(result.defense.effectiveDifficulty, 2);
  assert.equal(await rollTask(pc, { defenseType: "dodge", cooperativeMode: ["help", "distraction"] }), null);
});

test("determined draw redirects to the synthetic source and hinders its defense by two", async () => {
  setup(); const helper = actor("helper"), pc = actor("pc"), npc = actor("npc", "npc");
  registry.delete(helper.uuid); helper.uuid = "Scene.scene.Token.helper.Actor.helper"; registry.set(helper.uuid, helper);
  die = 12;
  await rollCooperativeAction(helper, npc, { kind: "draw" });
  die = 1;
  const result = await rollNpcAttack(npc, claw, { target: pc, cooperativeMode: "draw" });
  assert.equal(result.defense.effectiveDifficulty, 5);
  assert.equal(helper.system.wounds.moderate.current, 1);
  assert.equal(pc.system.wounds.moderate.current, 0);
});

test("two simultaneous draws cancel, and consumed draws cannot redirect later attacks", async () => {
  setup(); const helper = actor("helper"), other = actor("other"), pc = actor("pc"), npc = actor("npc", "npc");
  await declareCooperation(helper, npc, { kind: "draw" });
  await declareCooperation(other, npc, { kind: "draw" });
  assert.equal(await rollNpcAttack(npc, claw, { target: pc, cooperativeMode: "draw" }), null);
  await rollNpcAttack(npc, claw, { target: pc });
  assert.equal(getGeneralEffects(npc).filter(effect => effect.kind === "draw").length, 0);
});

test("taking a failed attack transfers wounds plus a minor and reroll removes only that contribution", async () => {
  setup(); const helper = actor("helper"), pc = actor("pc"), npc = actor("npc", "npc");
  await rollNpcAttack(npc, claw, { target: pc, cooperativeMode: "take", takeAttackActor: helper });
  const origin = messages[0];
  assert.equal(pc.system.wounds.moderate.current, 0);
  assert.equal(helper.system.wounds.moderate.current, 1);
  assert.equal(helper.system.wounds.minor.current, 1);
  assert.equal(await rollNpcAttack(npc, claw, { target: pc, cooperativeMode: "take", takeAttackActor: helper }), null);
  await helper.update({ "system.wounds.minor.current": 2 }); // Unrelated later injury.
  die = 20;
  await rerollMessage(pc, origin);
  assert.equal(helper.system.wounds.moderate.current, 0);
  assert.equal(helper.system.wounds.minor.current, 1);
  assert.equal(getGeneralEffects(helper).filter(effect => effect.kind === "takeCooldown").length, 0);
  assert.equal(pc.system.xp, 4);
});

test("guarding stops attacks, eases defense, and a successful intervention consumes the NPC action", async () => {
  setup(); const pc = actor("pc"), npc = actor("npc", "npc");
  await setGuarding(pc);
  assert.equal(await rollTask(pc, { isAttack: true, effortLevels: 1 }), null);
  die = 12;
  const guard = await rollCooperativeAction(pc, npc, { kind: "guard" });
  assert.equal(guard.effectiveDifficulty, 2);
  assert.deepEqual(await rollNpcAttack(npc, claw, { target: pc }), { stopped: true });
  await setGuarding(npc);
  assert.equal((await passGuard(pc, npc)).effectiveDifficulty, 4);
});

test("a stale guard reroll cannot stop a different later NPC action", async () => {
  setup(); const pc = actor("pc"), npc = actor("npc", "npc");
  await setGuarding(pc);
  await rollCooperativeAction(pc, npc, { kind: "guard" });
  const origin = messages[0];
  await rollNpcAttack(npc, claw, { target: pc });
  die = 20;
  const reroll = await rerollMessage(pc, origin);
  assert.equal(reroll.ruleEffect.state, "expired");
  assert.equal(getGeneralEffects(npc).length, 0);
});

test("poison can inflict wounds, Pool damage and a condition; a reroll reverses them without refunding effort", async () => {
  setup(); const pc = actor("pc");
  await resistSpecialDamage(pc, { kind: "poison", severity: "minor", poolDamage: { stat: "speed", amount: 3 },
    conditions: [{ kind: "dazed" }], effortLevels: 1 });
  assert.equal(pc.system.stats.might.pool.value, 7);
  assert.equal(pc.system.stats.speed.pool.value, 7);
  assert.equal(pc.system.wounds.minor.current, 1);
  assert.equal(getGeneralEffects(pc)[0].kind, "dazed");
  const origin = messages[0];
  die = 15;
  await rerollMessage(pc, origin);
  assert.equal(pc.system.stats.might.pool.value, 7);
  assert.equal(pc.system.stats.speed.pool.value, 10);
  assert.equal(pc.system.wounds.minor.current, 0);
  assert.equal(getGeneralEffects(pc).length, 0);
});

test("paralyzed defenders are hit without a defense roll, and unconscious NPC targets are automatic hits", async () => {
  setup(); const pc = actor("pc"), npc = actor("npc", "npc");
  pc.flags.cypher.generalEffects = [{ id: "paralysis", kind: "paralyzed" }];
  await rollNpcAttack(npc, claw, { target: pc });
  assert.equal(rolls, 0);
  assert.equal(pc.system.wounds.moderate.current, 1);
  npc.flags.cypher.generalEffects = [{ id: "sleep", kind: "unconscious" }];
  const other = actor("other");
  await rollTask(other, { isAttack: true, targetActor: npc, baseDamage: 4 });
  assert.equal(rolls, 0);
  assert.equal(npc.system.health.value, 8);
});

test("specialist disease damage survives ordinary restoration and its own reroll can remove it", async () => {
  setup(); const pc = actor("pc");
  await resistSpecialDamage(pc, { kind: "disease", severity: "minor", poolDamage: { stat: "speed", amount: 3 }, specialistRequired: true });
  const origin = messages[0];
  assert.equal(getRecoveryPools(pc).speed.max, 7);
  assert.equal(await rallyWound(pc, "minor"), false);
  assert.equal(await removeWound(pc, "minor"), false);
  await pc.update({ "system.wounds.minor.current": 0 });
  await pc.update({ "system.stats.speed.pool.value": 10 });
  assert.equal(pc.system.wounds.minor.current, 1);
  assert.equal(pc.system.stats.speed.pool.value, 7);
  die = 15;
  await rerollMessage(pc, origin);
  assert.equal(pc.system.wounds.minor.current, 0);
  assert.equal(pc.system.stats.speed.pool.value, 10);
  assert.equal(getGeneralEffects(pc).length, 0);
});

test("recovery removes ordinary wounds while preserving specialist-only wounds and Pool loss", async () => {
  setup(); const pc = actor("pc");
  pc.system.recoveries = { action: false, tenMinutes: false, hour: false, tenHours: false };
  await resistSpecialDamage(pc, { kind: "disease", severity: "minor", specialistRequired: true });
  await pc.update({ "system.wounds.minor.current": 2 });
  die = 4;
  await rollRecovery(pc, "tenMinutes");
  assert.equal(pc.system.wounds.minor.current, 1);
});

test("daily disease profiles persist; checks require game time or explicit passage and never refund their action costs", async () => {
  setup(); const pc = actor("pc"); game.time = { worldTime: 100 };
  await resistSpecialDamage(pc, { kind: "disease", poolDamage: { stat: "speed", amount: 1 }, ongoing: true });
  const disease = getGeneralEffects(pc).find(effect => effect.kind === "disease");
  pc.flags = JSON.parse(JSON.stringify(pc.flags));
  assert.equal(disease.nextCheckAt, 86500);
  assert.equal(await repeatDiseaseExposure(pc, disease.id), null);
  assert.equal(pc.system.stats.speed.pool.value, 9);
  game.time.worldTime = 86500;
  await repeatDiseaseExposure(pc, disease.id);
  assert.equal(pc.system.stats.speed.pool.value, 8);
  assert.equal(getGeneralEffects(pc).find(effect => effect.id === disease.id).nextCheckAt, 172900);
});

test("failed complementary help can succeed on a paid reroll and old cards never duplicate the asset", async () => {
  setup(); const helper = actor("helper"), pc = actor("pc");
  await rollCooperativeAction(helper, pc, { kind: "complement", taskLabel: "Negotiate", effortLevels: 1 });
  const origin = messages[0];
  die = 15;
  await rerollMessage(helper, origin);
  assert.equal(getGeneralEffects(pc).filter(effect => effect.kind === "help").length, 1);
  assert.equal(helper.system.stats.intellect.pool.value, 7);
  await rerollMessage(helper, origin);
  assert.equal(getGeneralEffects(pc).filter(effect => effect.kind === "help").length, 1);
});

test("initiative reordering does not consume a source's actual next turn", async () => {
  setup(); const helper = actor("helper"), pc = actor("pc");
  const combat = game.combat = { id: "combat", round: 1, turn: 0, flags: {},
    turns: [{ id: "pc", actor: pc }, { id: "helper", actor: helper }] };
  await declareCooperation(helper, pc, { kind: "defenseHelp" });
  const reordering = { turn: 1 };
  stampGeneralTurnRevision(combat, reordering, { cypherInitiativeReorder: true });
  combat.turns.reverse(); merge(combat, reordering);
  assert.equal(getGeneralEffects(pc).length, 1);
  const next = { round: 2, turn: 0 };
  stampGeneralTurnRevision(combat, next); merge(combat, next);
  assert.equal(getGeneralEffects(pc).length, 0);
});

test("a retained successful Block that still hits preserves the interception without replaying it", async () => {
  setup(); const helper = actor("helper"), pc = actor("pc"), npc = actor("npc", "npc");
  await rollNpcAttack(npc, claw, { target: pc, defenseType: "block", cooperativeMode: "take", takeAttackActor: helper });
  const origin = messages[0];
  die = 12;
  await rerollMessage(pc, origin);
  assert.equal(helper.system.wounds.moderate.current, 1);
  assert.equal(helper.system.wounds.minor.current, 1);
  assert.equal(pc.system.wounds.minor.current, 0);
  assert.equal(origin.flags.cypher.defenseConsequences.state, "corrected");
});

test("a partial complementary reroll never grants the asset or the twenty refund twice", async () => {
  setup(); const helper = actor("helper"), pc = actor("pc");
  await rollCooperativeAction(helper, pc, { kind: "complement", taskLabel: "Negotiate", effortLevels: 1 });
  const origin = messages[0], update = origin.update.bind(origin);
  origin.update = async patch => {
    if (patch["flags.cypher"]?.ruleEffect?.state === "applied" && patch["flags.cypher"].costRefunded) throw Error("final write failed");
    await update(patch);
  };
  die = 20;
  await assert.rejects(rerollMessage(helper, origin), /final write failed/);
  assert.equal(helper.system.stats.intellect.pool.value, 10);
  origin.update = update;
  await helper.update({ "system.stats.intellect.pool.value": 5 });
  await rerollMessage(helper, origin);
  assert.equal(helper.system.stats.intellect.pool.value, 5);
  assert.equal(getGeneralEffects(pc).filter(effect => effect.kind === "help").length, 1);
  assert.equal(origin.flags.cypher.ruleEffect.state, "manual");
});
