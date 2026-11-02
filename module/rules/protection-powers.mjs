/** CRD 956–957, 1745–1747 and 4537: paid protection, recipient recovery and exact-effect deduplication. */
export const PROTECTION_KEYS = ["mage-armor", "armoring-debris", "elemental-protection"];
const intervals = ["tenMinutes", "hour", "tenHours"];

/** Accepted adjudication: each dedicated level adds one step, up to complete major-wound prevention. */
export function protectionPlan(key, effort = 0) {
  if (!PROTECTION_KEYS.includes(key) || !Number.isSafeInteger(effort) || effort < 0 || effort > 2 || key !== "elemental-protection" && effort) return null;
  const elemental = key === "elemental-protection";
  return { key, cost: { "mage-armor": 1, "armoring-debris": 5, "elemental-protection": 4 }[key],
    recovery: key === "mage-armor" ? "tenHours" : elemental ? "hour" : "tenMinutes", steps: elemental ? 1 + effort : 0, effort };
}

/** The GM explicitly names the energy in a dedicated field; prose and localized Item names are never parsed. */
export function protectionEnergy(value = "", tags = []) {
  if (typeof value !== "string" || value.length > 80) return null;
  if (value.trim()) return value.trim().toLowerCase();
  const known = new Set(tags.map(tag => ({ fire: "fire", heat: "fire", cold: "cold", ice: "cold", electricity: "electricity" })[tag]).filter(Boolean));
  return known.size > 1 ? null : [...known][0] ?? "";
}

/** Identical energy/step bonuses do not stack; distinct bonuses apply, capped at three severity steps. */
export function elementalReduction(effects, energy) {
  if (!energy) return 0;
  const steps = new Set(effects.filter(effect => effect.key === "elemental-protection" && effect.energy === energy).map(effect => effect.steps));
  return Math.min(3, [...steps].filter(value => Number.isSafeInteger(value) && value >= 1 && value <= 3).reduce((sum, value) => sum + value, 0));
}

/** Recovery belongs to each recipient, independently of the original caster. */
export function protectionRecoveryUpdates(flags = {}, interval) {
  const last = intervals.indexOf(interval);
  return Object.fromEntries(intervals.slice(0, last + 1).map(key => [`flags.cypher.protectionRecoveries.${key}`, (flags.protectionRecoveries?.[key] ?? 0) + 1]));
}
