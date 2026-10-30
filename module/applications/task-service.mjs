import { speciesTaskPlan, speciesDamageReduction } from "./species-benefit-service.mjs";
import { companionFieldReduction } from "./companion-upgrade-read.mjs";
import { followerTaskPlan } from "./follower-service.mjs";
import { companionTaskPlan, companionTargetDefense } from "./companion-power-service.mjs";
import { objectDisplay, prepareObjectAttack } from "./object-service.mjs";
import { isOrdinaryRetryTask } from "../rules/task-retries.mjs";
import { TASK_RETRY_CONTEXT, validTaskRetry, beginTaskRetry, releaseTaskRetry, finishTaskRetry } from "./task-retry-history.mjs";
/**
 * Shared task engine for stat rolls, weapon attacks, and player defenses.
 * The pipeline resolves modifiers and cost, spends the Pool, optionally rolls the d20,
 * persists attack/defense consequences, then publishes chat. Rule calculations
 * live in module/rules; this service owns the Foundry document operations.
 */
import { resolveDefense } from "../rules/defense.mjs";
import { equipmentAttackProblem, canReadyShield, shieldReadyUpdate } from "./equipment-hands-service.mjs";
import { resolveTaskOutcome } from "../rules/task-outcome.mjs";
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { prepareTask } from "./task-preparation.mjs";
import { buildTaskMessage } from "./task-message.mjs";
import { applyTaskConsequences } from "./task-consequences.mjs";
import { syncWoundStatusEffects } from "./damage-service.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { canShieldAbsorbWound, isShieldBroken } from "../rules/wounds.mjs";
import { shieldSurvivesMajor, shieldOwnerItems, SHIELD_ABILITY_KEYS } from "../rules/shield-abilities.mjs";
import { resolveInitiativeScore } from "../rules/initiative.mjs";
import { persistInitiative, resolveInitiativeOwner, initiativeMessageOptions } from "./initiative-history.mjs";
import { cooperativeTaskPlan, consumeCooperationUpdate } from "./cooperative-service.mjs";
import { applyRuleEffect, validateRuleEffect } from "./rule-effect-consequence.mjs";
import { getGeneralEffects, nextSourceTurn } from "./general-effect-service.mjs";
import { specialDamageLimits } from "./special-damage-healing.mjs";
import { blockStillHits, CONDITION_KINDS } from "../rules/general-effects.mjs";
import { resolveShieldWoundTrack } from "../rules/ability-modifiers.mjs";
import { roundActionContext, consumeRoundAction, ROUND_ACTION_OWNER } from "./round-action-service.mjs";

/**
 * Roll Block, Dodge or a declared stat defense through the common task engine.
 *
 * @param {Actor} actor PC Actor.
 * @param {string} defenseType "block", "dodge", "might", "speed" or "intellect".
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
        : defenseType === "dodge" ? "CYPHER.Defense.Dodge" : `CYPHER.Stat.${defenseType}`
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
 * @param {Actor|null} [options.targetActor=null] Actual NPC or Object Actor receiving attack consequences.
 * @returns {Promise<object|null>} Roll result or null when the task is rejected.
 */
export async function rollTask(actor, options = {}) {
  if (!actor) return null;
  const initiativeOwner = options.initiative ? await resolveInitiativeOwner(options.initiative, actor) : null;
  if (options.initiative && (!initiativeOwner || actor.type !== "pc" || options.stat !== "speed"
    || options.difficulty !== 0 || options.isAttack || options.defenseType || options.targetActor
    || options.woundRemovalSeverity || options.shieldReturn || options.luckyShot)) return null;
  return runActorActions([actor, options.targetActor, options.npcSource, options.takeAttackActor, initiativeOwner?.combat,
    roundActionContext(options[ROUND_ACTION_OWNER] ?? actor, options)?.combat], "task",
    context => executeTask(actor, options, context, initiativeOwner), options[ACTION_CONTEXT]);
}

/** Execute one locally accepted task in explicit preparation/write/chat phases. */
async function executeTask(actor, {
  stat = "might", difficulty = 3, effortLevels = 0, assetSteps = 0,
  skillItemId = null, isAttack = false, baseDamage = 0, flavor = "",
  extraHinderSteps = 0, extraEaseSteps = 0, luckyShot = false,
  specialEffectChoice = null, weaponTargetEffects = [], weaponSource = {},
  weaponRangeAdjudication = null, abilitySource = null, spentAbilityEdge = 0,
  effectEffortLevels = 0, activationCost = 0, shieldReturn = null, initiative = null,
  defenseType = null, incomingSeverity = "minor", armorModifier = 0, shieldItemId = null,
  incomingPoolDamage = null, incomingDamageTags = [],
  targetActor = null, armorBypass = 0, incomingWounds = 1,
  applyIncomingWound = true, woundRemovalSeverity = null,
  damageEffortLevels = 0, freeEffortLevels = 0, freeDamageEffortLevels = 0, freeEffortSource = "",
  rollRoutine = true, chooseSpecialEffect = null, areaAttack = false, push = false,
  pushDamageEffortLevels = 0, powerShiftCategories = [], noPhysicalMovement = false, attackForm = null,
  benefitSelections = [], followerChoices = null, cooperativeMode = null, cooperativeEffectIds = null, ruleEffect = null, conditionsOnFailure = [], npcSource = null, takeAttackActor = null,
  automaticFailure = false, specialistRequired = false, environmentalSource = null,
  minorActivity = false, extraAction = false, extraActionSource = "", actionTiming = null,
  objectInteraction = null,
  taskLabel = "", taskDuration = null, [TASK_RETRY_CONTEXT]: retryContext = null,
  [ROUND_ACTION_OWNER]: roundActionOwner = null
} = {}, actionContext = null, initiativeOwner = null) {
  if (typeof taskLabel !== "string" || taskDuration !== null && typeof taskDuration !== "string") return null;
  // Validate an explicit shield selection before any cost or dice. Equipment
  // may change while a dialog is open; never silently spend on a stale choice.
  const shieldItem = shieldItemId ? actor.items?.get(shieldItemId) : null;
  if (shieldItemId && (defenseType !== "block" || !canShieldAbsorbWound(shieldItem)
    || shieldItem.isOwner === false || !canReadyShield(shieldItem))) return null;
  const physicalWeapon = isAttack && weaponSource?.itemId ? actor.items?.get?.(weaponSource.itemId) : null;
  if (physicalWeapon && equipmentAttackProblem(physicalWeapon, { abilitySource, equipmentFlightId: weaponSource.equipmentFlightId })) return null;
  if (shieldReturn) {
    const returning = actor.items?.get(shieldReturn.itemId);
    if (!canReadyShield(returning)) return null;
    const ability = actor.items?.get(abilitySource?.itemId);
    if (stat !== "speed" || difficulty !== 2 || isAttack || ability?.type !== "ability"
      || !SHIELD_ABILITY_KEYS.includes(ability.system.key) || ability.system.key === "hidden-shield"
      || returning?.type !== "shield" || returning.isOwner === false || typeof shieldReturn.flightId !== "string"
      || isShieldBroken(returning.system.wounds, shieldSurvivesMajor(returning, shieldOwnerItems(returning)))
      || !shieldReturn.flightId || returning.system.flightId !== shieldReturn.flightId || returning.system.inHand !== false) return null;
  }
  if (defenseType && (!["block", "dodge", "might", "speed", "intellect"].includes(defenseType)
    || !["minor", "moderate", "major"].includes(incomingSeverity)
    || !Number.isSafeInteger(incomingWounds) || incomingWounds < 1)) return null;
  if (!Array.isArray(incomingDamageTags) || incomingDamageTags.some(tag => !["falling", "fire", "heat", "cold", "ice"].includes(tag))) return null;
  if (!Array.isArray(conditionsOnFailure) || automaticFailure && !defenseType) return null;
  if (cooperativeMode === "take" && !takeAttackActor) return null;
  if (conditionsOnFailure.length && (!defenseType || conditionsOnFailure.some(effect =>
    !CONDITION_KINDS.includes(effect.kind)
    || !Number.isSafeInteger(effect.steps ?? 1) || (effect.steps ?? 1) < 1))) return null;
  if (ruleEffect && !validateRuleEffect(actor, targetActor, ruleEffect)) return null;
  if (environmentalSource && (!defenseType || typeof environmentalSource.id !== "string"
    || !environmentalSource.id || typeof environmentalSource.name !== "string" || !environmentalSource.name.trim()
    || !Number.isSafeInteger(environmentalSource.sequence) || environmentalSource.sequence < 0)) return null;
  if (takeAttackActor && (cooperativeMode !== "take" || !defenseType || npcSource?.type !== "npc"
    || takeAttackActor === actor || takeAttackActor.type !== "pc" || takeAttackActor.isOwner === false
    || getGeneralEffects(takeAttackActor).some(effect => ["takeCooldown", "unconscious", "stunned", "paralyzed"].includes(effect.kind)))) return null;
  if (incomingPoolDamage && (!defenseType || !["might", "speed", "intellect"].includes(incomingPoolDamage.stat)
    || !Number.isSafeInteger(incomingPoolDamage.amount) || incomingPoolDamage.amount < 0
    || !resolveStat(actor.system, incomingPoolDamage.stat))) return null;
  // Only reviewed treatment/rest services declare a wound removal. Validate
  // its actual target before the task can spend Effort or roll dice.
  if (woundRemovalSeverity && (targetActor?.type !== "pc" || targetActor.isOwner === false
    || !["minor", "moderate", "major"].includes(woundRemovalSeverity)
    || !(targetActor.system.wounds[woundRemovalSeverity].current > specialDamageLimits(targetActor).wounds[woundRemovalSeverity]))) return null;
  const ordinaryTask = isOrdinaryRetryTask({ isAttack, defenseType, initiative, shieldReturn, woundRemovalSeverity,
    abilitySource, ruleEffect, targetActor, cooperativeMode, environmentalSource, npcSource, minorActivity, extraAction, activationCost });
  if (retryContext && !ordinaryTask) return null;
  const objectPlan = targetActor?.type === "object" ? prepareObjectAttack(actor, targetActor, objectInteraction, weaponSource) : null;
  if (targetActor?.type === "object") {
    if (!isAttack || !objectPlan) { ui.notifications.warn(game.i18n.localize("CYPHER.Object.invalidAttack")); return null; }
    difficulty = objectPlan.before.originalLevel - objectPlan.before.levelDamage;
  }
  const cooperation = cooperativeTaskPlan(actor, cooperativeMode, Boolean(defenseType), npcSource, cooperativeEffectIds);
  if (!cooperation) return null;
  const companion = await companionTaskPlan(actor, { isAttack, defenseType });
  const following = await followerTaskPlan(actor, followerChoices, { isAttack, defenseType,
    excludedIds: companion.mounted ? [companion.followerId] : [] });
  if (!following) { ui.notifications.warn(game.i18n.localize("CYPHER.Follower.unavailable")); return null; }
  const species = speciesTaskPlan(actor, { selected: benefitSelections, isAttack, defenseType, skillItemId, weaponSource, attackForm });
  if (!species) { ui.notifications.warn(game.i18n.localize("CYPHER.Benefit.unavailable")); return null; }
  assetSteps += cooperation.assets + following.assets + species.assets + companion.assets;
  baseDamage += species.damage + companion.damage;
  if (isAttack) extraHinderSteps += await companionTargetDefense(targetActor);
  extraEaseSteps += cooperation.ease;
  extraHinderSteps += cooperation.hinder;
  const prepared = prepareTask(actor, { stat, difficulty, effortLevels, assetSteps, skillItemId,
    extraHinderSteps, extraEaseSteps, luckyShot, spentAbilityEdge, defenseType, armorModifier, targetActor,
    isAttack, baseDamage, damageEffortLevels, freeEffortLevels, freeDamageEffortLevels, freeEffortSource,
    areaAttack, push, pushDamageEffortLevels, powerShiftCategories, abilitySource, effectEffortLevels, activationCost,
    noPhysicalMovement, attackForm, automaticFailure, conditionalSkillSteps: species.skillSteps });
  if (!prepared) return null;
  const roundContext = roundActionOwner ? roundActionContext(roundActionOwner, { isAttack: true, actionTiming })
    : roundActionContext(actor, { isAttack, weaponSource, abilitySource, defenseType,
      initiative, shieldReturn, minorActivity, extraAction, extraActionSource, actionTiming });
  if (retryContext) {
    if (!validTaskRetry(actor, retryContext, prepared.effort, stat) || roundContext && !roundContext.kind) return null;
    await beginTaskRetry(retryContext);
  }
  if (!await consumeRoundAction(roundContext, actionContext)) {
    if (retryContext) await releaseTaskRetry(retryContext);
    ui.notifications.warn(game.i18n.localize("CYPHER.Round.Unavailable"));
    return null;
  }
  ({ effortLevels, assetSteps, extraHinderSteps } = prepared);
  const { resolved, statLabel, totalCost, xpCost, poolValue, poolMax,
    woundHinder, autoArmorSpeedHinder, effort, powerShifts, pushWound, skillSteps, totalSteps } = prepared;
  // Initiative has no success threshold. Retain unclamped task steps for its
  // score instead of deriving them from a difficulty already clamped to zero.
  const automaticHit = prepared.generalModifiers.automaticHit;
  const effectiveDifficulty = automaticFailure ? Math.max(1, prepared.effectiveDifficulty) : initiative || automaticHit ? 0 : prepared.effectiveDifficulty;
  const targetNumber = automaticFailure ? effectiveDifficulty * 3 : initiative || automaticHit ? 0 : prepared.targetNumber;
  baseDamage += effort.damageBonus + powerShifts.damage;
  weaponSource = { ...weaponSource, actorUuid: actor.uuid };

  // One Actor write commits XP and Pool costs together. Subsequent target
  // writes are separate operations; failures are surfaced without stale rollback.
  if (totalCost > 0 || xpCost > 0 || pushWound || cooperation.consumed.length) {
    await actor.update({
      ...consumeCooperationUpdate(actor, cooperation.consumed),
      ...(xpCost > 0 ? { "system.xp": actor.system.xp - xpCost } : {}),
      ...(totalCost > 0 ? { [`${resolved.path}.pool.value`]: poolValue - totalCost } : {}),
      ...(pushWound ? { [`system.wounds.${pushWound.target}.current`]: pushWound.current } : {})
    });
    if (pushWound && typeof actor.toggleStatusEffect === "function") await syncWoundStatusEffects(actor);
  }

  // Routine success is still an accepted action with costs and consequences.
  // Without dice it cannot create special results, refunds or a paid reroll.
  const roll = automaticFailure || automaticHit || !initiative && effectiveDifficulty <= 0 && !rollRoutine ? null : await new Roll("1d20").evaluate();
  const d20 = roll?.total ?? null;
  const offered = resolveTaskOutcome({ d20, effectiveDifficulty, isAttack, baseDamage }).special.effectOptions;
  if (offered.length && !offered.includes(specialEffectChoice) && chooseSpecialEffect) {
    specialEffectChoice = await chooseSpecialEffect(offered);
  }
  // Dismissing this post-roll choice cannot cancel an already resolved action.
  // Use damage as the fallback, while an explicit player choice takes priority.
  if (offered.length && !offered.includes(specialEffectChoice)) specialEffectChoice = "damage";
  const { success, special, damageBonus, selectedEffect, totalDamage } = resolveTaskOutcome({
    d20, effectiveDifficulty, isAttack, baseDamage, specialEffectChoice, suppressIntrusion: species.suppressIntrusion
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
  const incomingFieldReduction = companionFieldReduction(actor);

  const takeOnSuccessfulBlock = Boolean(takeAttackActor && blockStillHits({ defenseType, applyIncomingWound,
    incomingSeverity, incomingWounds, personalWoundReduction: speciesDamageReduction(actor, incomingDamageTags) + incomingFieldReduction, shieldWounds: usingShield ? resolveShieldWoundTrack(shieldItem.system.wounds,
      actor.system.activeAbilityEffects, shieldOwnerItems(shieldItem), actor.system) : null,
    survivesMajor: usingShield && shieldSurvivesMajor(shieldItem, shieldOwnerItems(shieldItem)) }));
  const defenseRecipient = takeAttackActor && (!success || takeOnSuccessfulBlock) ? takeAttackActor : actor;
  const takeCooldownId = defenseRecipient !== actor ? foundry.utils.randomID() : null;
  if (defenseRecipient !== actor) await defenseRecipient.update({ "flags.cypher.generalEffects": [
    ...getGeneralEffects(defenseRecipient), { id: takeCooldownId, kind: "takeCooldown", until: nextSourceTurn(defenseRecipient) }
  ] });
  const { targetDamage, attackConsequences, objectConsequences, woundRemovalApplied, shieldWoundsAbsorbed, defenseConsequences, defensePoolDamage } = await applyTaskConsequences(actor, { objectPlan, isAttack, success, targetActor,
    totalDamage, armorBypass, weaponTargetEffects, weaponSource, defenseType,
    incomingDamageTags, applyIncomingWound, incomingWounds, usingShield, shieldItem, incomingSeverity, incomingPoolDamage,
    conditionsOnFailure, woundRemovalSeverity, actionContext, defenseRecipient, takeCooldownId, specialistRequired });
  if (ruleEffect) ruleEffect = await applyRuleEffect(targetActor, ruleEffect, success);
  if (success && shieldReturn) {
    const returning = actor.items.get(shieldReturn.itemId);
    await returning.update(shieldReadyUpdate(returning));
  }
  if (initiative) {
    initiative = { ...initiative, steps: totalSteps, score: resolveInitiativeScore(d20, totalSteps), state: "applied" };
    await persistInitiative(initiativeOwner, initiative.score, initiative);
  }

  let messageFlavor = initiative ? `<div class="cypher-roll-card"><h3>${game.i18n.localize("CYPHER.Initiative.Label")}</h3>
    <p>${game.i18n.format("CYPHER.Initiative.Result", { roll: d20, steps: totalSteps, score: initiative.score })}</p>
    ${effectText ? `<p>${effectText}</p>` : ""}
    ${refund && totalCost > 0 ? `<p>${game.i18n.localize("CYPHER.Roll.CostRefunded")}</p>` : ""}</div>` : buildTaskMessage({
    applyIncomingWound, statLabel, defenseType, success, usingShield: shieldWoundsAbsorbed > 0, shieldItem, incomingSeverity,
    shieldWoundsAbsorbed, incomingWounds,
    weaponSource, isAttack, flavor, abilitySource, targetActor, difficulty, effectiveDifficulty,
    targetNumber, effortLevels, totalCost, woundHinder, extraHinderSteps, weaponRangeAdjudication,
    armorModifier, autoArmorSpeedHinder, damageBonus, totalDamage, effectText, refund,
    effort, powerShifts, assetSteps, skillSteps, rolled: Boolean(roll), automatic: automaticHit || automaticFailure
  });
  if (defenseRecipient !== actor) messageFlavor += `<p>${game.i18n.format("CYPHER.General.Taken", { name: foundry.utils.escapeHTML(defenseRecipient.name) })}</p>`;
  if (objectConsequences) {
    const state = objectDisplay(targetActor);
    messageFlavor += `<p>${game.i18n.format("CYPHER.Object.result", { name: foundry.utils.escapeHTML(targetActor.name), level: state.level,
      status: game.i18n.localize(`CYPHER.Object.${state.status}`) })}</p>`;
    if (objectConsequences.ineffective) messageFlavor += `<p>${game.i18n.localize("CYPHER.Object.ineffective")}</p>`;
    if (objectConsequences.state === "manual") messageFlavor += `<p>${game.i18n.localize("CYPHER.Object.manual")}</p>`;
  }
  if (environmentalSource) messageFlavor += `<p>${game.i18n.localize("CYPHER.Environment.title")}: ${foundry.utils.escapeHTML(environmentalSource.name)}</p>`;

  // Flags are structured metadata for rerolls and tests; the localized HTML
  // is presentation. Publish only after target-side writes have succeeded.
  const message = {
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flavor: messageFlavor,
    flags: {
      ...(initiative ? { core: { initiativeRoll: true } } : {}),
      "cypher": {
        rerollable: Boolean(roll),
        rollType: "task",
        abilitySource,
        ...(ordinaryTask ? { taskAttempt: { version: 1, stat, difficulty, skillItemId,
          label: retryContext?.label ?? (taskLabel || flavor || statLabel),
          duration: retryContext?.duration ?? taskDuration,
          parentMessageId: retryContext?.source.id ?? null } } : {}),
        actorId: actor.id,
        actorUuid: actor.uuid,
        ...(environmentalSource ? { environmentalSource } : {}),
        ...(initiative ? { initiative } : {}),
        ...(shieldReturn ? { shieldReturn: { ...shieldReturn, applied: success } } : {}),
        ...(defenseType ? { defenseType, shieldItemId, shieldWoundsAbsorbed, incomingWounds, incomingSeverity,
          incomingDamageTags, applyIncomingWound, incomingPoolDamage, incomingFieldReduction, conditionsOnFailure, defenseConsequences } : {}),
        ...(woundRemovalSeverity ? { woundRemoval: {
          targetUuid: targetActor.uuid, severity: woundRemovalSeverity, applied: woundRemovalApplied
        } } : {}),
        stat,
        cooperativeMode,
        ...(species.applied.length ? { speciesBenefits: species.applied, suppressIntrusion: species.suppressIntrusion } : {}),
        ...(following.sources.length ? { followerHelp: following.sources } : {}),
        ...(companion.contextId ? { companionBenefits: { contextId: companion.contextId, npcUuid: companion.npcUuid,
          assets: companion.assets, damage: companion.damage, mounted: companion.mounted } } : {}),
        ...(takeAttackActor ? { takeOnSuccessfulBlock } : {}),
        ...(ruleEffect ? { ruleEffect } : {}),
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
        ...(objectConsequences ? { objectConsequences } : {}),
        armorBypass
      }
    }
  };
  const published = roll ? await roll.toMessage(message, initiative ? initiativeMessageOptions(initiative) : {})
    : await ChatMessage.create({ ...message, content: messageFlavor });
  if (retryContext) await finishTaskRetry(retryContext, published);

  return {
    roll,
    success,
    targetNumber,
    effectiveDifficulty,
    damage: totalDamage,
    targetDamage,
    defensePoolDamage,
    weaponTargetEffects,
    specialEffectOptions: special.effectOptions,
    ...(retryContext ? { message: published } : {})
  };
}


