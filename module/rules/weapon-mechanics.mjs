/**
 * Pure resolution helpers for structured weapon mechanics.
 *
 * Weapon mechanics are source-derived data. This module only determines which
 * target effects apply to a target level; it does not mutate Foundry documents.
 */

/**
 * Select target effects whose level bounds include the target level.
 *
 * @param {Array<object>} effects Structured weapon target effects.
 * @param {number} targetLevel Target NPC/creature level.
 * @returns {Array<object>} Matching effects in source order.
 */
export function resolveWeaponTargetEffects(effects = [], targetLevel) {
  if (!Number.isInteger(targetLevel) || targetLevel < 0) return [];

  return effects.filter(effect => {
    const minimum = Number.isInteger(effect?.minimumTargetLevel)
      ? effect.minimumTargetLevel
      : 0;
    const maximum = effect?.maximumTargetLevel;

    return targetLevel >= minimum
      && (maximum === null || maximum === undefined || targetLevel <= maximum);
  });
}


/**
 * Resolve an explicitly adjudicated weapon range for an attack.
 *
 * Range categories are intentionally approximate in the CRD. The runtime
 * must not infer a category from token coordinates or grid measurements. The
 * GM/roller declares whether the target is at the weapon's range limit; this
 * declaration applies the CRD's one-step hindrance for extreme range.
 *
 * @param {object} options Source range data and the explicit adjudication.
 * @param {string|null} [options.range=null] Weapon's listed normal range.
 * @param {string|null} [options.extremeRange=null] Listed extreme range.
 * @param {boolean} [options.atExtremeRange=false] Explicit GM adjudication.
 * @returns {{range: string|null, extremeRange: string|null,
 *   atExtremeRange: boolean, hinderSteps: number}}
 */
export function resolveWeaponRangeAdjudication({
  range = null,
  extremeRange = null,
  atExtremeRange = false
} = {}) {
  const adjudicated = atExtremeRange === true;
  return {
    range: range || null,
    extremeRange: extremeRange || null,
    atExtremeRange: adjudicated,
    hinderSteps: adjudicated ? 1 : 0
  };
}


/**
 * Resolve the active weapon configuration without mutating source data.
 * The CRD's alternate configuration changes the weapon category, which
 * supplies its category damage. The primary configuration retains its
 * explicitly declared damage.
 *
 * @param {object} system Attack Item system data.
 * @returns {{configuration: string, attackType: string|null,
 *   baseDamage: number|null, actionTiming: string|null,
 *   switchAction: string|null}}
 */
export function resolveWeaponConfiguration(system = {}) {
  const mechanics = system.mechanics ?? {};
  const alternate = mechanics.alternateConfiguration ?? {};
  const isAlternate = mechanics.activeConfiguration === "alternate"
    && alternate.enabled === true
    && ["light", "medium", "heavy"].includes(alternate.attackType);
  const attackType = isAlternate ? alternate.attackType : system.attackType;
  const explicitDamage = Number.isFinite(system.damage) ? system.damage : null;
  const categoryDamage = { light: 2, medium: 4, heavy: 6 }[attackType] ?? null;
  const actionTiming = {
    light: "firstAction",
    medium: "action",
    heavy: "lastAction"
  }[attackType] ?? null;
  return {
    configuration: isAlternate ? "alternate" : "primary",
    attackType: attackType || null,
    baseDamage: isAlternate
      ? categoryDamage
      : (explicitDamage || categoryDamage || 2),
    actionTiming,
    switchAction: isAlternate ? "action"
      : (alternate.enabled ? alternate.action || "action" : null)
  };
}
