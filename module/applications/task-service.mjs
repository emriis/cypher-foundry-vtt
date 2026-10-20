/**
 * Shared task engine for stat rolls, weapon attacks, and player defenses.
 * The pipeline resolves modifiers and cost, spends the Pool, optionally rolls the d20,
 * persists attack/defense consequences, then publishes chat. Rule calculations
 * live in module/rules; this service owns the Foundry document operations.
 */
import { resolveDefense } from "../rules/defense.mjs";
import { resolveTaskOutcome } from "../rules/task-outcome.mjs";
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { prepareTask } from "./task-preparation.mjs";
import { buildTaskMessage } from "./task-message.mjs";
import { applyTaskConsequences } from "./task-consequences.mjs";
import { syncWoundStatusEffects } from "./damage-service.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { canShieldAbsorbWound, isShieldBroken } from "../rules/wounds.mjs";
import { shieldSurvivesMajor, shieldOwnerItems, SHIELD_ABILITY_KEYS } from "../rules/shield-abilities.mjs";

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
    skillItemId = null,
    ...taskOptions
  } = {}
) {
  if (actor.type !== "pc") return null;

  const { stat, armorModifier } = resolveDefense(
    defenseType,
    actor.system.armor
  );

  const result = await rollTask(actor, {
    ...taskOptions,
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
 * @param {number} [options.damageEffortLevels=0] Paid attack Effort allocated to damage.
 * @param {number} [options.freeEffortLevels=0] Declared ordinary free easing levels.
 * @param {number} [options.freeDamageEffortLevels=0] Declared ordinary free damage levels.
 * @param {string} [options.freeEffortSource=""] Caller-confirmed applicable CRD source.
 * @param {boolean} [options.rollRoutine=true] Whether to roll when effective difficulty is zero.
 * @param {number} [options.assetSteps=0] Ease from assets, capped at two steps.
 * @param {Actor|null} [options.targetActor=null] Actual NPC receiving attack consequences.
 * @returns {Promise<object|null>} Roll result or null when the task is rejected.
 */
export async function rollTask(actor, options = {}) {
  if (!actor) return null;
  return runActorActions([actor, options.targetActor], "task", context => executeTask(actor, options, context), options[ACTION_CONTEXT]);
}

/** Execute one locally accepted task in explicit preparation/write/chat phases. */
async function executeTask(actor, {
  stat = "might", difficulty = 3, effortLevels = 0, assetSteps = 0,
  skillItemId = null, isAttack = false, baseDamage = 0, flavor = "",
  extraHinderSteps = 0, extraEaseSteps = 0, luckyShot = false,
  specialEffectChoice = null, weaponTargetEffects = [], weaponSource = {},
  weaponRangeAdjudication = null, abilitySource = null, spentAbilityEdge = 0,
  effectEffortLevels = 0, activationCost = 0, shieldReturn = null,
  defenseType = null, incomingSeverity = "minor", armorModifier = 0, shieldItemId = null,
  incomingPoolDamage = null,
  targetActor = null, armorBypass = 0, incomingWounds = 1,
  applyIncomingWound = true, woundRemovalSeverity = null,
  damageEffortLevels = 0, freeEffortLevels = 0, freeDamageEffortLevels = 0, freeEffortSource = "",
  rollRoutine = true, chooseSpecialEffect = null, areaAttack = false, push = false,
  pushDamageEffortLevels = 0, powerShiftCategories = []
} = {}, actionContext = null) {
  // Validate an explicit shield selection before any cost or dice. Equipment
  // may change while a dialog is open; never silently spend on a stale choice.
  const shieldItem = shieldItemId ? actor.items?.get(shieldItemId) : null;
  if (shieldItemId && (defenseType !== "block" || !canShieldAbsorbWound(shieldItem)
    || shieldItem.isOwner === false)) return null;
  if (shieldReturn) {
    const returning = actor.items?.get(shieldReturn.itemId);
    const ability = actor.items?.get(abilitySource?.itemId);
    if (stat !== "speed" || difficulty !== 2 || isAttack || ability?.type !== "ability"
      || !SHIELD_ABILITY_KEYS.includes(ability.system.key) || ability.system.key === "hidden-shield"
      || returning?.type !== "shield" || returning.isOwner === false || typeof shieldReturn.flightId !== "string"
      || isShieldBroken(returning.system.wounds, shieldSurvivesMajor(returning, shieldOwnerItems(returning)))
      || !shieldReturn.flightId || returning.system.flightId !== shieldReturn.flightId || returning.system.inHand !== false) return null;
  }
  if (defenseType && (!["block", "dodge"].includes(defenseType)
    || !["minor", "moderate", "major"].includes(incomingSeverity)
    || !Number.isSafeInteger(incomingWounds) || incomingWounds < 1)) return null;
  if (incomingPoolDamage && (!defenseType || !["might", "speed", "intellect"].includes(incomingPoolDamage.stat)
    || !Number.isSafeInteger(incomingPoolDamage.amount) || incomingPoolDamage.amount < 0
    || !resolveStat(actor.system, incomingPoolDamage.stat))) return null;
  // Only reviewed treatment/rest services declare a wound removal. Validate
  // its actual target before the task can spend Effort or roll dice.
  if (woundRemovalSeverity && (targetActor?.type !== "pc" || targetActor.isOwner === false
    || !["minor", "moderate", "major"].includes(woundRemovalSeverity)
    || !(targetActor.system.wounds[woundRemovalSeverity].current > 0))) return null;
  const prepared = prepareTask(actor, { stat, difficulty, effortLevels, assetSteps, skillItemId,
    extraHinderSteps, extraEaseSteps, luckyShot, spentAbilityEdge, defenseType, armorModifier, targetActor,
    isAttack, baseDamage, damageEffortLevels, freeEffortLevels, freeDamageEffortLevels, freeEffortSource,
    areaAttack, push, pushDamageEffortLevels, powerShiftCategories, abilitySource, effectEffortLevels, activationCost });
  if (!prepared) return null;
  ({ effortLevels, assetSteps, extraHinderSteps } = prepared);
  const { resolved, statLabel, totalCost, xpCost, poolValue, poolMax,
    woundHinder, autoArmorSpeedHinder, effectiveDifficulty, targetNumber, effort, powerShifts, pushWound, skillSteps } = prepared;
  baseDamage += effort.damageBonus + powerShifts.damage;

  // One Actor write commits XP and Pool costs together. Subsequent target
  // writes are separate operations; failures are surfaced without stale rollback.
  if (totalCost > 0 || xpCost > 0 || pushWound) {
    await actor.update({
      ...(xpCost > 0 ? { "system.xp": actor.system.xp - xpCost } : {}),
      ...(totalCost > 0 ? { [`${resolved.path}.pool.value`]: poolValue - totalCost } : {}),
      ...(pushWound ? { [`system.wounds.${pushWound.target}.current`]: pushWound.current } : {})
    });
    if (pushWound && typeof actor.toggleStatusEffect === "function") await syncWoundStatusEffects(actor);
  }

  // Routine success is still an accepted action with costs and consequences.
  // Without dice it cannot create special results, refunds or a paid reroll.
  const roll = effectiveDifficulty <= 0 && !rollRoutine ? null : await new Roll("1d20").evaluate();
  const d20 = roll?.total ?? null;
  const offered = resolveTaskOutcome({ d20, effectiveDifficulty, isAttack, baseDamage }).special.effectOptions;
  if (offered.length && !offered.includes(specialEffectChoice) && chooseSpecialEffect) {
    specialEffectChoice = await chooseSpecialEffect(offered);
  }
  // Dismissing this post-roll choice cannot cancel an already resolved action.
  // Use damage as the fallback, while an explicit player choice takes priority.
  if (offered.length && !offered.includes(specialEffectChoice)) specialEffectChoice = "damage";
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
    // Dice and a post-roll choice are asynchronous. Refund the paid amount
    // into the current Pool instead of restoring a potentially stale snapshot.
    const current = resolveStat(actor.system, stat);
    await actor.update({ [`${current.path}.pool.value`]: Math.min(poolMax, current.data.pool.value + totalCost) });
  }

  // A successful Block can transfer the whole wound to an equipped, unbroken shield
  // instead of reducing it by one step on the character.
  const usingShield = defenseType === "block" && canShieldAbsorbWound(shieldItem);

  const { targetDamage, attackConsequences, woundRemovalApplied, shieldWoundsAbsorbed, defenseConsequences, defensePoolDamage } = await applyTaskConsequences(actor, { isAttack, success, targetActor,
    totalDamage, armorBypass, weaponTargetEffects, weaponSource, defenseType,
    applyIncomingWound, incomingWounds, usingShield, shieldItem, incomingSeverity, incomingPoolDamage, woundRemovalSeverity, actionContext });
  if (success && shieldReturn) {
    await actor.items.get(shieldReturn.itemId).update({ "system.inHand": true, "system.equipped": true });
  }

  const messageFlavor = buildTaskMessage({
    applyIncomingWound, statLabel, defenseType, success, usingShield: shieldWoundsAbsorbed > 0, shieldItem, incomingSeverity,
    shieldWoundsAbsorbed, incomingWounds,
    weaponSource, isAttack, flavor, abilitySource, targetActor, difficulty, effectiveDifficulty,
    targetNumber, effortLevels, totalCost, woundHinder, extraHinderSteps, weaponRangeAdjudication,
    armorModifier, autoArmorSpeedHinder, damageBonus, totalDamage, effectText, refund,
    effort, powerShifts, assetSteps, skillSteps, rolled: Boolean(roll)
  });

  // Flags are structured metadata for rerolls and tests; the localized HTML
  // is presentation. Publish only after target-side writes have succeeded.
  const message = {
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flavor: messageFlavor,
    flags: {
      "cypher": {
        rerollable: Boolean(roll),
        rollType: "task",
        abilitySource,
        actorId: actor.id,
        actorUuid: actor.uuid,
        ...(shieldReturn ? { shieldReturn: { ...shieldReturn, applied: success } } : {}),
        ...(defenseType ? { defenseType, shieldItemId, shieldWoundsAbsorbed, incomingWounds, incomingSeverity,
          applyIncomingWound, incomingPoolDamage, defenseConsequences } : {}),
        ...(woundRemovalSeverity ? { woundRemoval: {
          targetUuid: targetActor.uuid, severity: woundRemovalSeverity, applied: woundRemovalApplied
        } } : {}),
        stat,
        effortCost: totalCost,
        effortAllocation: effort,
        freeEffortSource,
        powerShifts,
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
        ...(attackConsequences ? { attackConsequences } : {}),
        armorBypass
      }
    }
  };
  if (roll) await roll.toMessage(message);
  else await ChatMessage.create({ ...message, content: messageFlavor });

  return {
    roll,
    success,
    targetNumber,
    effectiveDifficulty,
    damage: totalDamage,
    targetDamage,
    defensePoolDamage,
    weaponTargetEffects,
    specialEffectOptions: special.effectOptions
  };
}


