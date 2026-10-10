/** Validate current Actor state and calculate a task plan before any write. */
import { CYPHER } from "../config.mjs";
import { clampAssetSteps, clampEffortLevels, computeEffortCost, computeTaskSteps, resolveTaskDifficulty } from "../rules/tasks.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";

/**
 * Resolve costs and modifiers from a read-only snapshot of the actual Actor.
 * Rejection reports its reason but never spends resources or rolls dice.
 * @param {Actor} actor Acting PC, including a synthetic token Actor.
 * @param {object} options Normalized roll inputs from the task service.
 * @returns {object|null} Prepared values or null when validation rejects the request.
 */
export function prepareTask(actor, { stat, difficulty, effortLevels, assetSteps, skillItemId,
  extraHinderSteps, extraEaseSteps, luckyShot, spentAbilityEdge, defenseType, armorModifier, targetActor }) {
  if (actor.type !== "pc") {
    ui.notifications.warn(game.i18n.localize("CYPHER.Warning.NotPC"));
    return null;
  }
  if (actor.isOwner === false || targetActor?.isOwner === false) {
    ui.notifications.warn(game.i18n.localize("CYPHER.Warning.ActionPermission"));
    return null;
  }

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
  // Effort cannot exceed the character's Effort score (max 6).
  effortLevels = clampEffortLevels(effortLevels, actor.system.effort);

  const skillItem = skillItemId ? actor.items.get(skillItemId) : null;
  const skillSteps = skillItem ? skillItem.system.stepModifier : 0;

  const abilityItems = actor.items?.contents
    ?? (Array.isArray(actor.items)
      ? actor.items
      : Array.from(actor.items?.values?.() ?? []));
  const abilityModifiers = resolveActiveAbilityModifiers(
    actor.system.activeAbilityEffects,
    abilityItems
  );
  const abilityEdge = abilityModifiers.edge?.[stat] ?? 0;
  const abilityPoolMax = abilityModifiers.poolMax?.[stat] ?? 0;
  const edge = (statData.edge ?? 0) + abilityEdge;
  const poolValue = statData.pool.value;
  const poolMax = statData.pool.max + abilityPoolMax;
  // Edge reduces a cost; it is not a Pool of spendable points. An Ability
  // and its first attack share the action's Edge, so subtract the portion
  // already used for activation before reducing this attack's Effort cost.
  const totalCost = computeEffortCost(effortLevels, Math.max(0, edge - spentAbilityEdge));

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

  // Each Effort level reduces difficulty by one step; assets, skill, wound hindrance,
  // and any extra hindrance (lucky shot, unfamiliar weapon...) also apply.
  const woundHinder = actor.system.hinderSteps ?? 0;

  // An unfamiliar armor's Speed hindrance is applied to all Speed tasks, except Dodge,
  // where armorModifier already applies the same value.
  const autoArmorSpeedHinder = (stat === "speed" && defenseType !== "dodge")
    ? (actor.system.armor?.speedTaskHinder ?? 0)
    : 0;

  const totalSteps = computeTaskSteps({
    effortLevels,
    assetSteps,
    skillSteps,
    extraEaseSteps,
    woundHinder,
    extraHinderSteps,
    armorModifier,
    autoArmorSpeedHinder
  });
  const { effectiveDifficulty, targetNumber } =
    resolveTaskDifficulty(difficulty, totalSteps);

  return { resolved, statLabel, effortLevels, assetSteps, extraHinderSteps,
    totalCost, xpCost, poolValue, poolMax, woundHinder, autoArmorSpeedHinder,
    effectiveDifficulty, targetNumber };
}
