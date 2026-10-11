/**
 * Shared task engine for stat rolls, weapon attacks, and player defenses.
 * The pipeline resolves modifiers and cost, spends the Pool, rolls the d20,
 * persists attack/defense consequences, then publishes chat. Rule calculations
 * live in module/rules; this service owns the Foundry document operations.
 */
import { resolveDefense } from "../rules/defense.mjs";
import { resolveTaskOutcome } from "../rules/task-outcome.mjs";
import { runActorAction } from "./action-guard.mjs";
import { prepareTask } from "./task-preparation.mjs";
import { buildTaskMessage } from "./task-message.mjs";
import { applyTaskConsequences } from "./task-consequences.mjs";

/**
 * Roll a Block or Dodge defense through the common task engine.
 *
 * @param {Actor} actor PC Actor.
 * @param {string} defenseType "block" or "dodge".
 * @param {object} options Defense roll options.
 * @returns {Promise<object|null>} Roll result.
 */
export async function rollDefense(
  actor,
  defenseType,
  {
    difficulty = 3,
    effortLevels = 0,
    assetSteps = 0,
    incomingSeverity = "minor",
    incomingWounds = 1,
    applyIncomingWound = true,
    shieldItemId = null,
    skillItemId = null
  } = {}
) {
  if (actor.type !== "pc") return null;

  const { stat, armorModifier } = resolveDefense(
    defenseType,
    actor.system.armor
  );

  const result = await rollTask(actor, {
    stat,
    difficulty,
    effortLevels,
    assetSteps,
    armorModifier,
    skillItemId,
    defenseType,
    incomingSeverity,
    incomingWounds,
    applyIncomingWound,
    shieldItemId,
    flavor: game.i18n.localize(
      defenseType === "block"
        ? "CYPHER.Defense.Block"
        : "CYPHER.Defense.Dodge"
    )
  });

  if (!result) return null;
  return {
    ...result,
    stat,
    armorModifier,
    defenseType,
    incomingSeverity
  };
}

/**
 * Execute a task roll at the Foundry application boundary.
 *
 * Deterministic task calculations live in rules/tasks.mjs. This service owns
 * the remaining orchestration: Actor state, XP/Pool transactions, dice,
 * chat output, and wound application.
 *
 * @param {Actor} actor Cypher Actor performing the task.
 * @param {object} [options={}] Roll choices and attack/defense context.
 * @param {string} [options.stat="might"] Stat whose Pool funds Effort.
 * @param {number} [options.difficulty=3] Base difficulty before task steps.
 * @param {number} [options.effortLevels=0] Requested Effort levels, not Pool points.
 * @param {number} [options.assetSteps=0] Ease from assets, capped at two steps.
 * @param {Actor|null} [options.targetActor=null] Actual NPC receiving attack consequences.
 * @returns {Promise<object|null>} Roll result or null when the task is rejected.
 */
export async function rollTask(actor, options = {}) {
  if (!actor) return null;
  return runActorAction(actor, "task", () => executeTask(actor, options));
}

/** Execute one locally accepted task in explicit preparation/write/chat phases. */
async function executeTask(actor, {
  stat = "might", difficulty = 3, effortLevels = 0, assetSteps = 0,
  skillItemId = null, isAttack = false, baseDamage = 0, flavor = "",
  extraHinderSteps = 0, extraEaseSteps = 0, luckyShot = false,
  specialEffectChoice = null, weaponTargetEffects = [], weaponSource = {},
  weaponRangeAdjudication = null, abilitySource = null, spentAbilityEdge = 0,
  defenseType = null, incomingSeverity = "minor", armorModifier = 0, shieldItemId = null,
  targetActor = null, armorBypass = 0, incomingWounds = 1,
  applyIncomingWound = true, woundRemovalSeverity = null
} = {}) {
  // Only reviewed treatment/rest services declare a wound removal. Validate
  // its actual target before the task can spend Effort or roll dice.
  if (woundRemovalSeverity && (targetActor?.type !== "pc" || targetActor.isOwner === false
    || !["minor", "moderate", "major"].includes(woundRemovalSeverity)
    || !(targetActor.system.wounds[woundRemovalSeverity].current > 0))) return null;
  const prepared = prepareTask(actor, { stat, difficulty, effortLevels, assetSteps, skillItemId,
    extraHinderSteps, extraEaseSteps, luckyShot, spentAbilityEdge, defenseType, armorModifier, targetActor });
  if (!prepared) return null;
  ({ effortLevels, assetSteps, extraHinderSteps } = prepared);
  const { resolved, statLabel, totalCost, xpCost, poolValue, poolMax,
    woundHinder, autoArmorSpeedHinder, effectiveDifficulty, targetNumber } = prepared;

  // One Actor write commits XP and Pool costs together. Subsequent target
  // writes are separate operations; failures are surfaced without stale rollback.
  if (totalCost > 0 || xpCost > 0) {
    await actor.update({
      ...(xpCost > 0 ? { "system.xp": actor.system.xp - xpCost } : {}),
      ...(totalCost > 0 ? { [`${resolved.path}.pool.value`]: poolValue - totalCost } : {})
    });
  }

  const roll = await new Roll("1d20").evaluate();
  const d20 = roll.total;
  const { success, special, damageBonus, selectedEffect, totalDamage } = resolveTaskOutcome({
    d20, effectiveDifficulty, isAttack, baseDamage, specialEffectChoice
  });
  const effectText = special.gmIntrusion
    ? game.i18n.localize("CYPHER.Roll.GMIntrusionFree")
    : selectedEffect === "minor"
      ? game.i18n.localize("CYPHER.Roll.MinorEffect")
      : selectedEffect === "major"
        ? game.i18n.localize("CYPHER.Roll.MajorEffect")
        : "";
  const refund = special.refundsCost;

  // A natural 20 refunds the action's point cost.
  if (refund && totalCost > 0) {
    await actor.update({ [`${resolved.path}.pool.value`]: Math.min(poolMax, poolValue) });
  }

  // A successful Block can transfer the whole wound to an equipped, unbroken shield
  // instead of reducing it by one step on the character.
  const shieldItem = shieldItemId ? actor.items.get(shieldItemId) : null;
  const usingShield = defenseType === "block" && shieldItem?.type === "shield" && !shieldItem.system.broken;

  const messageFlavor = buildTaskMessage({
    applyIncomingWound, statLabel, defenseType, success, usingShield, shieldItem, incomingSeverity,
    weaponSource, isAttack, flavor, abilitySource, targetActor, difficulty, effectiveDifficulty,
    targetNumber, effortLevels, totalCost, woundHinder, extraHinderSteps, weaponRangeAdjudication,
    armorModifier, autoArmorSpeedHinder, damageBonus, totalDamage, effectText, refund
  });

  const { targetDamage, woundRemovalApplied } = await applyTaskConsequences(actor, { isAttack, success, targetActor,
    totalDamage, armorBypass, weaponTargetEffects, weaponSource, defenseType,
    applyIncomingWound, incomingWounds, usingShield, shieldItem, incomingSeverity, woundRemovalSeverity });

  // Flags are structured metadata for rerolls and tests; the localized HTML
  // is presentation. Publish only after target-side writes have succeeded.
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flavor: messageFlavor,
    flags: {
      "cypher": {
        rerollable: true,
        rollType: "task",
        abilitySource,
        actorId: actor.id,
        ...(woundRemovalSeverity ? { actorUuid: actor.uuid, woundRemoval: {
          targetUuid: targetActor.uuid, severity: woundRemovalSeverity, applied: woundRemovalApplied
        } } : {}),
        stat,
        effortCost: totalCost,
        costRefunded: refund,
        d20,
        targetNumber,
        effectiveDifficulty,
        isAttack,
        baseDamage,
        specialEffectChoice,
        weaponTargetEffects,
        weaponRangeAdjudication,
        weaponSource,
        targetActorId: targetActor?.type === "npc" ? targetActor.id : null,
        armorBypass
      }
    }
  });

  return {
    roll,
    success,
    targetNumber,
    effectiveDifficulty,
    damage: totalDamage,
    targetDamage,
    weaponTargetEffects,
    specialEffectOptions: special.effectOptions
  };
}


