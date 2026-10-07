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
