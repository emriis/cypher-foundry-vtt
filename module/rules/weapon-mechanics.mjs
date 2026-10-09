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
