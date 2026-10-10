/**
 * Match Ability expiration conditions without reading or updating Foundry.
 * Recovery names have a duration order; "minimum" accepts the named recovery
 * and longer ones, while an exact condition accepts only the named interval.
 */
import { CYPHER } from "../config.mjs";

const RECOVERY_ORDER = {
  action: 0,
  tenMinutes: 1,
  hour: 2,
  tenHours: 3
};

/**
 * Test one declared recovery condition; unknown intervals never match.
 * For example, a minimum "hour" condition also matches "tenHours".
 *
 * @param {string} recoveryInterval Recovery that actually completed.
 * @param {object|null} condition End condition with kind, interval, and minimum.
 * @returns {boolean} Whether the recovery satisfies this condition.
 */
export function recoverySatisfiesEndCondition(recoveryInterval, condition) {
  if (!condition || condition.kind !== "recovery") return false;
  if (!CYPHER.recoveryIntervals.includes(recoveryInterval)) return false;
  if (condition.interval === "any") return true;

  const required = RECOVERY_ORDER[condition.interval];
  const actual = RECOVERY_ORDER[recoveryInterval];
  if (required === undefined || actual === undefined) return false;

  return condition.minimum ? actual >= required : actual === required;
}

/**
 * An effect expires when any of its recovery end conditions matches.
 *
 * @param {object|null} effect Structured Ability effect; missing conditions are allowed.
 * @param {string} recoveryInterval Recovery that actually completed.
 * @returns {boolean} Whether the caller should remove the active reference.
 */
export function abilityEffectEndsOnRecovery(effect, recoveryInterval) {
  return (effect?.endConditions ?? []).some(condition =>
    recoverySatisfiesEndCondition(recoveryInterval, condition)
  );
}
