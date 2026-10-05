import { CYPHER } from "../config.mjs";

const RECOVERY_ORDER = {
  action: 0,
  tenMinutes: 1,
  hour: 2,
  tenHours: 3
};

export function recoverySatisfiesEndCondition(recoveryInterval, condition) {
  if (!condition || condition.kind !== "recovery") return false;
  if (!CYPHER.recoveryIntervals.includes(recoveryInterval)) return false;
  if (condition.interval === "any") return true;

  const required = RECOVERY_ORDER[condition.interval];
  const actual = RECOVERY_ORDER[recoveryInterval];
  if (required === undefined || actual === undefined) return false;

  return condition.minimum ? actual >= required : actual === required;
}

export function abilityEffectEndsOnRecovery(effect, recoveryInterval) {
  return (effect?.endConditions ?? []).some(condition =>
    recoverySatisfiesEndCondition(recoveryInterval, condition)
  );
}
