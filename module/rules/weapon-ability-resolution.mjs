/**
 * Pure, source-backed resolution contracts for weapon-dependent abilities.
 *
 * These functions resolve only the deterministic parts of the CRD rules.
 * Callers must roll dice, establish target adjacency, and perform resource
 * transactions at the application boundary.
 */

/**
 * Resolve the number of attacks used by Spray.
 *
 * The caller supplies the result of the CRD's 1d6 roll and the number of
 * attacks-worth of ammunition, power, or thrown weapons actually available.
 * A null availableUses value means the caller has not modelled a consumable
 * store (for example, an untracked-ammunition campaign); it does not authorize
 * the application to invent or decrement a resource.
 *
 * @param {object} options Spray roll and resource context.
 * @param {number} options.dieResult Result of 1d6.
 * @param {number|null} [options.availableUses=null] Available attacks/uses.
 * @returns {{eligible: boolean, requestedUses: number,
 *   usesToConsume: number, assetSteps: number, damageAdjustment: number,
 *   reason: string|null}}
 */
export function resolveSprayUse({
  dieResult,
  availableUses = null
} = {}) {
  if (!Number.isInteger(dieResult) || dieResult < 1 || dieResult > 6) {
    return {
      eligible: false,
      requestedUses: 0,
      usesToConsume: 0,
      assetSteps: 0,
      damageAdjustment: 0,
      reason: "invalid-die-result"
    };
  }

  if (
    availableUses !== null
    && (!Number.isInteger(availableUses) || availableUses < 0)
  ) {
    return {
      eligible: false,
      requestedUses: dieResult + 1,
      usesToConsume: 0,
      assetSteps: 0,
      damageAdjustment: 0,
      reason: "invalid-available-uses"
    };
  }

  const requestedUses = dieResult + 1;
  const usesToConsume = availableUses === null
    ? requestedUses
    : Math.min(requestedUses, availableUses);

  if (usesToConsume === 0) {
    return {
      eligible: false,
      requestedUses,
      usesToConsume: 0,
      assetSteps: 0,
      damageAdjustment: 0,
      reason: "no-available-uses"
    };
  }

  return {
    eligible: true,
    requestedUses,
    usesToConsume,
    assetSteps: 1,
    damageAdjustment: -1,
    reason: null
  };
}

/**
 * Resolve the per-target attack modifiers for Arc Spray.
 *
 * Target adjacency is an explicit GM/application-layer adjudication; this
 * function never derives it from token coordinates.
 *
 * @param {object} options Arc Spray target context.
 * @param {string[]} options.targetIds Exactly three distinct target IDs.
 * @param {boolean} options.allAdjacent Whether the GM confirms adjacency.
 * @returns {{eligible: boolean, attacks: Array<object>, reason: string|null}}
 */
export function resolveArcSprayAttacks({
  targetIds = [],
  allAdjacent = false
} = {}) {
  const uniqueTargetIds = new Set(targetIds);
  if (
    !Array.isArray(targetIds)
    || targetIds.length !== 3
    || uniqueTargetIds.size !== 3
    || targetIds.some(id => typeof id !== "string" || id.length === 0)
  ) {
    return {
      eligible: false,
      attacks: [],
      reason: "requires-three-distinct-targets"
    };
  }

  if (allAdjacent !== true) {
    return {
      eligible: false,
      attacks: [],
      reason: "targets-not-confirmed-adjacent"
    };
  }

  return {
    eligible: true,
    attacks: targetIds.map(targetId => ({
      targetId,
      extraHinderSteps: 1
    })),
    reason: null
  };
}
