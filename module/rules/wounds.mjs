import { CYPHER } from "../config.mjs";

/**
 * Reduce a wound by one severity step.
 *
 * @param {string} severity Wound severity.
 * @returns {string|null} Reduced severity, or null when the wound disappears.
 */
export function reduceWoundSeverity(severity) {
  if (severity === "major") return "moderate";
  if (severity === "moderate") return "minor";
  return null;
}

/**
 * Resolve cascading wound overflow against a wound track.
 *
 * @param {string} severity Incoming wound severity.
 * @param {object} wounds Wound track with current/max values.
 * @returns {string} Track that receives the wound.
 */
export function resolveWoundSeverity(severity, wounds) {
  let target = severity;

  if (target === "minor" && wounds.minor.current >= wounds.minor.max) {
    target = "moderate";
  }
  if (
    target === "moderate" &&
    wounds.moderate.current >= wounds.moderate.max
  ) {
    target = "major";
  }

  return target;
}

/**
 * Resolve shield wound overflow using the shield's wound capacities.
 *
 * @param {string} severity Incoming wound severity.
 * @param {object} wounds Shield wound track.
 * @returns {string} Shield track that receives the wound.
 */
export function resolveShieldWoundSeverity(severity, wounds) {
  return resolveWoundSeverity(severity, wounds);
}

/**
 * Convert Pool damage into a wound severity.
 *
 * @param {number} amount Overflow damage.
 * @returns {string} Wound severity.
 */
export function convertDamageToWound(amount) {
  for (const tier of CYPHER.poolDamageToWound) {
    if (amount <= tier.max) return tier.severity;
  }
  return "major";
}

/**
 * Calculate the next wound value without applying persistence.
 *
 * @param {string} severity Incoming wound severity.
 * @param {object} wounds Wound track.
 * @returns {{target: string, current: number, max: number}}
 */
export function computeWoundIncrease(severity, wounds) {
  const target = resolveWoundSeverity(severity, wounds);
  return {
    target,
    current: Math.min(wounds[target].current + 1, wounds[target].max),
    max: wounds[target].max
  };
}
