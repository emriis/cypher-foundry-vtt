/** Validate current Actor state and calculate a task plan before any write. */
import { CYPHER } from "../config.mjs";
import { clampAssetSteps, computeTaskSteps, resolveTaskDifficulty } from "../rules/tasks.mjs";
import { resolveTaskEffort, resolveTaskPowerShifts } from "../rules/task-effort.mjs";
import { computeWoundIncrease } from "../rules/wounds.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { resolveActiveAbilityModifiers, resolveAbilityWoundTrack } from "../rules/ability-modifiers.mjs";

/**
 * Read the source-key Ability and its explicitly chosen Pool, never its name.
 * @param {Actor} actor Actual PC whose owned Items and flags establish eligibility.
 * @param {string} stat Pool used by this task.
 * @returns {number} Rank bonus in that Pool, or zero when no grant applies.
 */
export function getSuperheroicsRank(actor, stat) {
  const items = actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);
  return ["might", "speed", "intellect"].includes(stat)
    && actor.flags?.cypher?.superheroicsStat === stat
    && items.some(item => item.type === "ability" && item.system.key === "superheroics")
    ? actor.system.rank ?? 1 : 0;
}

/**
 * Resolve costs and modifiers from a read-only snapshot of the actual Actor.
 * Rejection reports its reason but never spends resources or rolls dice.
 * @param {Actor} actor Acting PC, including a synthetic token Actor.
 * @param {object} options Normalized roll inputs from the task service.
 * @returns {object|null} Prepared values or null when validation rejects the request.
 */
export function prepareTask(actor, { stat, difficulty, effortLevels, assetSteps, skillItemId,
  extraHinderSteps, extraEaseSteps, luckyShot, spentAbilityEdge, defenseType, armorModifier, targetActor,
  isAttack, baseDamage, damageEffortLevels, freeEffortLevels, freeDamageEffortLevels, freeEffortSource,
  areaAttack, push, pushDamageEffortLevels, powerShiftCategories, abilitySource }) {
  if (actor.type !== "pc") {
    ui.notifications.warn(game.i18n.localize("CYPHER.Warning.NotPC"));
    return null;
  }
  if (actor.isOwner === false || targetActor?.isOwner === false) {
    ui.notifications.warn(game.i18n.localize("CYPHER.Warning.ActionPermission"));
    return null;
  }

  // HTML min/max attributes do not protect macro/API callers. Reject malformed
  // units before costs or dice; legitimate over-limit assets are still capped.
  if (![difficulty, assetSteps, extraHinderSteps, extraEaseSteps, spentAbilityEdge, baseDamage]
    .every(value => Number.isSafeInteger(value) && value >= 0) || !Number.isSafeInteger(armorModifier)
    || difficulty > (actor.system.maxDifficulty ?? (actor.system.genre === "superhero" ? 15 : 10))) return invalidTask();
  if ((freeEffortLevels || freeDamageEffortLevels)
    && (typeof freeEffortSource !== "string" || !freeEffortSource.trim())) return invalidTask();

  // CRD > Lucky Shot: the cost belongs to an accepted action. Validate all
  // resources first; a rejected request must not spend its XP.
  const xpCost = luckyShot ? CYPHER.xpCosts.luckyShot : 0;
  if (luckyShot) extraHinderSteps += 4;

  const resolved = resolveStat(actor.system, stat);
  if (!resolved) return null;
  const statData = resolved.data;
  const statLabel = CYPHER.stats.includes(stat) ? game.i18n.localize(resolved.label) : resolved.label;

  // Asset steps are capped at 2.
  assetSteps = clampAssetSteps(assetSteps);
  const skillItem = skillItemId ? actor.items.get(skillItemId) : null;
  if (skillItemId && skillItem?.type !== "skill") return invalidTask();
  const skillSteps = skillItem ? skillItem.system.stepModifier : 0;
  if (!Number.isSafeInteger(skillSteps) || skillSteps < -1 || skillSteps > 3) return invalidTask();

  const abilityItems = actor.items?.contents
    ?? (Array.isArray(actor.items)
      ? actor.items
      : Array.from(actor.items?.values?.() ?? []));
  const abilityModifiers = resolveActiveAbilityModifiers(
    actor.system.activeAbilityEffects,
    abilityItems, actor.system
  );
  const abilityEdge = abilityModifiers.edge?.[stat] ?? 0;
  const abilityPoolMax = abilityModifiers.poolMax?.[stat] ?? 0;
  const edge = (statData.edge ?? 0) + abilityEdge;
  const poolValue = statData.pool.value;
  const poolMax = statData.pool.max + abilityPoolMax;
  // Edge reduces a cost; it is not a Pool of spendable points. An Ability
  // and its first attack share the action's Edge, so subtract the portion
  // already used for activation before reducing this attack's Effort cost.
  const effort = resolveTaskEffort({ effortLevels, damageEffortLevels, freeEffortLevels,
    freeDamageEffortLevels, effortScore: actor.system.effort,
    edge: Math.max(0, edge - spentAbilityEdge), superheroicsRank: getSuperheroicsRank(actor, stat),
    push, pushDamageEffortLevels, isAttack, areaAttack });
  const powerShifts = resolveTaskPowerShifts({
    shifts: actor.system.powerShifts, isAttack, defenseType, categories: powerShiftCategories, abilitySource
  });
  if (!effort || !powerShifts) return invalidTask();
  const totalCost = effort.cost;

  if (totalCost > poolValue) {
    ui.notifications.error(game.i18n.format("CYPHER.Warning.NotEnoughPool", { stat: statLabel }));
    return null;
  }
  if (xpCost > (actor.system.xp ?? 0)) {
    ui.notifications.error(game.i18n.format("CYPHER.Warning.NotEnoughXP", {
      amount: xpCost, reason: game.i18n.localize("CYPHER.XP.LuckyShot")
    }));
    return null;
  }

  // Only Effort allocated to easing reduces difficulty. Skill, assets, wounds,
  // and circumstance modifiers still contribute their separate step adjustments.
  let woundHinder = actor.system.hinderSteps ?? 0;
  let pushWound = null;
  if (push) {
    // The wound is an action cost, not ordinary free Effort. Plan the same
    // track overflow as addWound before writes, including its new hindrance.
    if (!actor.system.wounds) return invalidTask();
    const wounds = resolveAbilityWoundTrack(actor.system.wounds, actor.system.activeAbilityEffects, abilityItems, actor.system);
    pushWound = computeWoundIncrease("moderate", wounds);
    if (pushWound.current <= wounds[pushWound.target].current) return invalidTask();
    wounds[pushWound.target].current = pushWound.current;
    woundHinder = (wounds.moderate.max > 0 && wounds.moderate.current >= wounds.moderate.max ? 1 : 0)
      + wounds.major.current;
  }

  // An unfamiliar armor's Speed hindrance is applied to all Speed tasks, except Dodge,
  // where armorModifier already applies the same value.
  const autoArmorSpeedHinder = (stat === "speed" && defenseType !== "dodge")
    ? (actor.system.armor?.speedTaskHinder ?? 0)
    : 0;

  const totalSteps = computeTaskSteps({
    effortLevels: effort.easingLevels,
    assetSteps,
    skillSteps,
    extraEaseSteps: extraEaseSteps + powerShifts.ease,
    woundHinder,
    extraHinderSteps,
    armorModifier,
    autoArmorSpeedHinder
  });
  const { effectiveDifficulty, targetNumber } =
    resolveTaskDifficulty(difficulty, totalSteps);

  return { resolved, statLabel, effortLevels: effort.effortLevels, assetSteps, extraHinderSteps,
    effort, powerShifts, pushWound, skillSteps,
    totalCost, xpCost, poolValue, poolMax, woundHinder, autoArmorSpeedHinder,
    effectiveDifficulty, targetNumber };
}

/** Report validation rejection without turning it into a partial transaction. */
function invalidTask() {
  ui.notifications.warn(game.i18n.localize("CYPHER.Roll.InvalidModifiers"));
  return null;
}
