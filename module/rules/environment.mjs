/** Declared environmental profiles; CRD Special Damage (7815–7823), with GM adjudication. */
import { CONDITION_KINDS } from "./general-effects.mjs";
import { reduceWoundSeverity } from "./wounds.mjs";

/**
 * Validate and copy a GM declaration, never deriving mechanics from its name.
 * @param {object} input Explicit consequences and optional interval in seconds.
 * @returns {object|null} Canonical serializable profile, or null when invalid.
 */
export function normalizeEnvironmentalProfile(input) {
  if (!input || typeof input.name !== "string" || !input.name.trim()
    || !["immediate", "defense"].includes(input.mode)) return null;
  const { mode, stat = null, difficulty = null, severity = null, wounds = 1, poolDamage = null,
    damageTags = [], conditions = [], intervalSeconds = null, noPhysicalMovement = false, protection = {} } = input;
  if (mode === "defense" && (!["might", "speed", "intellect"].includes(stat)
    || !Number.isSafeInteger(difficulty) || difficulty < 0 || difficulty > 15)) return null;
  if (severity !== null && !["minor", "moderate", "major"].includes(severity)
    || !Number.isSafeInteger(wounds) || wounds < 1 || typeof noPhysicalMovement !== "boolean"
    || intervalSeconds !== null && (!Number.isSafeInteger(intervalSeconds) || intervalSeconds < 1)) return null;
  if (poolDamage !== null && (!poolDamage || !["might", "speed", "intellect"].includes(poolDamage.stat)
    || !Number.isSafeInteger(poolDamage.amount) || poolDamage.amount < 1)) return null;
  if (!Array.isArray(damageTags) || damageTags.some(tag => !["falling", "fire", "heat", "cold", "ice"].includes(tag))) return null;
  if (!Array.isArray(conditions) || conditions.some(effect => !effect || !CONDITION_KINDS.includes(effect.kind)
    || !Number.isSafeInteger(effect.steps ?? 1) || (effect.steps ?? 1) < 1)) return null;
  if (!severity && !poolDamage && !conditions.length || !protection || typeof protection !== "object") return null;
  const { source = "", woundReduction = 0, poolReduction = 0, immune = false } = protection;
  if (typeof source !== "string" || typeof immune !== "boolean"
    || !Number.isSafeInteger(woundReduction) || woundReduction < 0 || woundReduction > 3
    || !Number.isSafeInteger(poolReduction) || poolReduction < 0
    || (immune || woundReduction || poolReduction) && !source.trim()) return null;
  return { name: input.name.trim(), mode, stat: mode === "defense" ? stat : null,
    difficulty: mode === "defense" ? difficulty : null, severity, wounds,
    poolDamage: poolDamage ? { stat: poolDamage.stat, amount: poolDamage.amount } : null,
    ...(damageTags.length ? { damageTags: [...new Set(damageTags)] } : {}),
    conditions: conditions.map(effect => ({ kind: effect.kind, steps: effect.steps ?? 1 })),
    intervalSeconds, noPhysicalMovement,
    protection: { source: source.trim(), woundReduction, poolReduction, immune } };
}

/**
 * Apply only explicitly adjudicated protection; Armor, shields and prose are not consulted.
 * @param {object} profile Valid normalized declaration.
 * @returns {object} Declared wounds, Pool hit and conditions after protection, without mutation.
 */
export function environmentalConsequences(profile) {
  let severity = profile.severity;
  for (let i = 0; i < profile.protection.woundReduction && severity; i++) severity = reduceWoundSeverity(severity);
  const amount = Math.max(0, (profile.poolDamage?.amount ?? 0) - profile.protection.poolReduction);
  return { severity: profile.protection.immune ? null : severity, wounds: profile.wounds,
    poolDamage: !profile.protection.immune && amount ? { stat: profile.poolDamage.stat, amount } : null,
    conditions: profile.protection.immune ? [] : profile.conditions.map(effect => ({ ...effect })) };
}

/**
 * Check saved readiness without authorizing stale buttons or processing checkpoints.
 * @param {object} exposure Saved versioned occurrence state.
 * @param {number} sequence Sequence captured before opening any input dialog.
 * @param {number|undefined} now Current game time in seconds.
 * @param {boolean} [intervalPassed=false] GM confirmation of elapsed narrative time.
 * @returns {boolean} Whether this particular occurrence may be applied.
 */
export function environmentalExposureDue(exposure, sequence, now, intervalPassed = false) {
  return exposure?.version === 1 && exposure.state === "ready" && Number.isSafeInteger(sequence)
    && sequence === exposure.sequence && (sequence === 0 || intervalPassed === true
      || Number.isFinite(now) && Number.isFinite(exposure.nextAt) && now >= exposure.nextAt);
}
