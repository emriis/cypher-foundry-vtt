/** Source-backed general actions compose the shared task engine, costs and reroll history. */
import { rollTask, rollDefense } from "./task-service.mjs";
import { getGeneralEffects, nextSourceTurn } from "./general-effect-service.mjs";
import { runActorAction, ACTION_CONTEXT } from "./action-guard.mjs";

/** Complementary help always grants one asset; a determined foe requires an Intellect draw task. */
export async function rollCooperativeAction(actor, target, { kind, taskLabel = "", ...options } = {}) {
  if (!["complement", "draw", "guard"].includes(kind) || actor?.type !== "pc"
    || actor === target || !target?.uuid || target.isOwner === false) return null;
  if (kind === "complement" ? target.type !== "pc" || !taskLabel.trim() : target.type !== "npc") return null;
  if (kind === "guard" && !getGeneralEffects(actor).some(effect => effect.kind === "guarding")) return null;
  const effect = { id: foundry.utils.randomID(), sourceUuid: actor.uuid,
    kind: kind === "complement" ? "help" : kind === "guard" ? "preventAction" : "draw",
    ...(kind === "complement" ? { assets: 1, taskLabel: taskLabel.trim() } : {
      actionRevision: target.flags?.cypher?.weaponActionRevision ?? 0, until: nextSourceTurn(actor),
      ...(kind === "draw" ? { hinder: 2 } : {})
    }) };
  return rollTask(actor, { ...options, stat: kind === "draw" ? "intellect" : kind === "guard" ? "speed" : options.stat ?? "intellect",
    difficulty: kind === "complement" ? options.difficulty ?? 3 : target.system.level,
    extraEaseSteps: (options.extraEaseSteps ?? 0) + (kind === "guard" ? 1 : 0),
    isAttack: false, targetActor: target, defenseType: null,
    ruleEffect: { targetUuid: target.uuid, effect, applied: false } });
}

/** Resolve the explicit Speed task needed to pass an NPC guard, without invented movement. */
export async function passGuard(actor, target, options = {}) {
  if (target?.type !== "npc" || !getGeneralEffects(target).some(effect => effect.kind === "guarding")) return null;
  return rollTask(actor, { ...options, stat: "speed", difficulty: target.system.level,
    extraHinderSteps: (options.extraHinderSteps ?? 0) + 1, isAttack: false, targetActor: target });
}

/**
 * Resist an explicitly declared poison, daily disease exposure, or psychic attack.
 * Wounds, Pool loss and conditions can coexist. The caller supplies the actual
 * threat profile: the CRD supplies no universal poison/disease damage or duration.
 * Each daily exposure is explicit, rather than silently rolling unattended dice.
 */
export async function resistSpecialDamage(actor, { kind, difficulty = 3, severity = null, wounds = 1,
  poolDamage = null, conditions = [], specialistRequired = false, ongoing = false, ...options } = {}) {
  if (!["poison", "disease", "psychic"].includes(kind)) return null;
  if (ongoing && kind !== "disease") return null;
  return runActorAction(actor, "specialDamage", async context => {
    const result = await rollDefense(actor, kind === "psychic" ? "intellect" : "might", { ...options, difficulty,
      [ACTION_CONTEXT]: context,
      incomingSeverity: severity ?? "minor", incomingWounds: wounds, applyIncomingWound: severity !== null,
      incomingPoolDamage: poolDamage, conditionsOnFailure: conditions, noPhysicalMovement: true,
      specialistRequired,
      shieldItemId: null });
    if (result && ongoing) await actor.update({ "flags.cypher.generalEffects": [...getGeneralEffects(actor), {
      id: foundry.utils.randomID(), kind: "disease", nextCheckAt: Number.isFinite(game.time?.worldTime) ? game.time.worldTime + 86400 : null,
      profile: { kind, difficulty, severity, wounds, poolDamage, conditions, specialistRequired }
    }] });
    return result;
  }, options[ACTION_CONTEXT]);
}

/** Repeat one declared daily exposure, advancing its own reminder only after an accepted task. */
export async function repeatDiseaseExposure(actor, id, { dayPassedConfirmed = false, ...options } = {}) {
  return runActorAction(actor, "dailyExposure", async context => {
    const disease = getGeneralEffects(actor).find(effect => effect.id === id && effect.kind === "disease");
    if (!disease || actor.isOwner === false || (!dayPassedConfirmed
      && !(Number.isFinite(disease.nextCheckAt) && game.time?.worldTime >= disease.nextCheckAt))) return null;
    const result = await resistSpecialDamage(actor, { ...options, ...disease.profile, [ACTION_CONTEXT]: context });
    if (result) await actor.update({ "flags.cypher.generalEffects": getGeneralEffects(actor).map(effect => effect.id === id
      ? { ...effect, nextCheckAt: Number.isFinite(game.time?.worldTime) ? game.time.worldTime + 86400 : null } : effect) });
    return result;
  });
}
