/** Pure CRD Healing Wounds > Treatment and Healing Hand (Cleric/Tends to the Wounded). */
import { reduceWoundSeverity } from "./wounds.mjs";

const TIMES = {
  standard: ["oneMinute", "tenMinutes", "hour"],
  realistic: ["tenMinutes", "hour", "week"],
  heroic: ["lastAction", "oneMinute", "tenMinutes"]
};

/**
 * Read source treatment difficulty and suggested duration. The caller confirms
 * the appropriate time profile rather than inferring a subgenre from a name.
 * Machine Not Flesh uses engineering difficulties 1/3/5 instead of healing 0/3/6.
 * @param {string} severity Wound severity.
 * @param {string} [profile="standard"] Standard, realistic, or heroic CRD table.
 * @param {boolean} [machine=false] Explicit Machine Not Flesh contract.
 * @returns {object|null} Difficulty/time/skill contract, or null for invalid choices.
 */
export function treatmentProfile(severity, profile = "standard", machine = false) {
  const index = ["minor", "moderate", "major"].indexOf(severity);
  if (index < 0 || !TIMES[profile]) return null;
  return { difficulty: (machine ? [1, 3, 5] : [0, 3, 6])[index], time: TIMES[profile][index],
    skill: machine ? "engineering" : "healing" };
}

/**
 * Reduce exactly one existing wound, without overflowing the lower track.
 * This is Healing Hand's capacity restriction, unlike taking a new wound.
 * @param {object} wounds Current wound counts and effective capacities.
 * @param {string} severity Wound to heal.
 * @returns {object|null} Actor paths, or null for an absent/full/unknown track.
 */
export function healingHandUpdates(wounds, severity) {
  if (!["minor", "moderate", "major"].includes(severity) || !(wounds[severity]?.current > 0)) return null;
  const lower = reduceWoundSeverity(severity);
  if (lower && wounds[lower].current >= wounds[lower].max) return null;
  return { [`system.wounds.${severity}.current`]: wounds[severity].current - 1,
    ...(lower ? { [`system.wounds.${lower}.current`]: wounds[lower].current + 1 } : {}) };
}
