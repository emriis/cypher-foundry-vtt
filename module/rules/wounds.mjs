import { CYPHER } from "../config.mjs";
import { resolveNpcHealthDamage } from "./npc-combat.mjs";

/**
 * Resolve the damage that remains after NPC Armor.
 *
 * @param {number} amount Raw incoming damage.
 * @param {number} armor NPC Armor value.
 * @returns {number} Damage that reaches NPC Health.
 */
export function resolveNpcDamage(amount, armor = 0, armorBypass = 0) {
  return resolveNpcHealthDamage(amount, armor, armorBypass);
}

/**
 * Resolve damage to a stat Pool and any overflow that becomes a wound.
 *
 * @param {number} amount Incoming Pool damage.
 * @param {number} poolValue Current Pool value.
 * @returns {{poolDamage: number, overflow: number, woundSeverity: string|null}}
 */
export function resolvePoolDamage(amount, poolValue) {
  const damage = Math.max(0, Number(amount));
  const currentPool = Math.max(0, Number(poolValue));
  const poolDamage = Math.min(damage, currentPool);
  const overflow = damage - poolDamage;

  return {
    poolDamage,
    overflow,
    woundSeverity: overflow > 0 ? convertDamageToWound(overflow) : null
  };
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
