/** CRD > Effort, Free Level of Effort, and Superheroes Genre > Superheroics. */
import { clampEffortLevels, computeEffortCost } from "./tasks.mjs";

/**
 * Allocate levels before paying anything. Paid easing and damage share the
 * character's score; ordinary free levels bypass that score, but share the
 * six-level ceiling. Superheroics raises both limits by rank in its chosen Pool.
 * Its wound-funded two levels still consume the character's raised score.
 * Legacy easing-only requests retain their clamping contract. A split request
 * exceeding a limit is rejected rather than silently changing the allocation.
 * @param {object} input Counts in levels, Edge in Pool points.
 * @param {number} [input.effortLevels=0] Paid levels allocated to easing.
 * @param {number} [input.damageEffortLevels=0] Paid levels allocated to attack damage.
 * @param {number} [input.freeEffortLevels=0] Ordinary free easing levels.
 * @param {number} [input.freeDamageEffortLevels=0] Ordinary free damage levels.
 * @param {number} [input.effortScore] Character score; a missing score rejects the request.
 * @param {number} [input.edge=0] Edge remaining for this action's Pool.
 * @param {number} [input.superheroicsRank=0] Rank only when the owned Ability applies to this Pool.
 * @param {boolean} [input.push=false] Accept the wound-funded two-level grant.
 * @param {number} [input.pushDamageEffortLevels=0] Pushed levels allocated to damage, from zero to two.
 * @param {boolean} [input.isAttack=false] Whether damage allocation is valid.
 * @param {boolean} [input.areaAttack=false] Use the CRD area-damage increment.
 * @returns {object|null} Allocation and cost, or null for invalid choices.
 */
export function resolveTaskEffort({ effortLevels = 0, damageEffortLevels = 0,
  freeEffortLevels = 0, freeDamageEffortLevels = 0, effortScore, edge = 0,
  superheroicsRank = 0, push = false, pushDamageEffortLevels = 0, isAttack = false, areaAttack = false } = {}) {
  if (![effortLevels, damageEffortLevels, freeEffortLevels, freeDamageEffortLevels,
    effortScore, edge, superheroicsRank, pushDamageEffortLevels].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  if (!isAttack && (damageEffortLevels || freeDamageEffortLevels || pushDamageEffortLevels)) return null;
  if (push && !superheroicsRank) return null;
  if (pushDamageEffortLevels > 2 || (pushDamageEffortLevels && !push)) return null;
  const maximum = 6 + superheroicsRank;
  const scoreLimit = effortScore + superheroicsRank;
  if (!damageEffortLevels && !freeEffortLevels && !freeDamageEffortLevels && !push) {
    effortLevels = clampEffortLevels(effortLevels, scoreLimit, maximum);
  }
  const paidLevels = effortLevels + damageEffortLevels;
  const pushLevels = push ? 2 : 0;
  if (paidLevels + pushLevels > scoreLimit
    || paidLevels + pushLevels + freeEffortLevels + freeDamageEffortLevels > maximum) return null;
  return { effortLevels, damageEffortLevels, freeEffortLevels, freeDamageEffortLevels,
    paidLevels, pushLevels, pushDamageEffortLevels,
    easingLevels: effortLevels + freeEffortLevels + pushLevels - pushDamageEffortLevels,
    damageBonus: (damageEffortLevels + freeDamageEffortLevels + pushDamageEffortLevels) * (areaAttack ? 2 : 3),
    cost: computeEffortCost(paidLevels, edge), scoreLimit, maximum };
}

/**
 * Permanent Power Shifts are separate from ordinary free Effort (CRD > Power
 * Shifts). Accuracy and Block/Dodge applicability are known from the action.
 * Other categories require an explicit declaration: skill names and prose
 * cannot establish whether this is one of the two Savant skills, for example.
 * Special categories (Healing, Flight, etc.) never become generic easing.
 * @param {object} context Persisted shift counts and declared applicability.
 * @param {Record<string, number>} [context.shifts={}] Stored counts by category, zero to three.
 * @param {boolean} [context.isAttack=false] Attack context for Accuracy and damage bonuses.
 * @param {string|null} [context.defenseType=null] Block or Dodge, when known.
 * @param {string[]} [context.categories=[]] Explicitly confirmed conditional categories.
 * @param {object|null} [context.abilitySource=null] Source identity required for Power.
 * @returns {{ease: number, damage: number}|null} Permanent bonuses or invalid input.
 */
export function resolveTaskPowerShifts({ shifts = {}, isAttack = false,
  defenseType = null, categories = [], abilitySource = null } = {}) {
  const selectable = ["dexterity", "intelligence", "resilience", "strength", "savant", "singleAttack", "power"];
  if (!Array.isArray(categories) || categories.some(key => !selectable.includes(key))) return null;
  const applicable = new Set(categories);
  if (isAttack) applicable.add("accuracy");
  if (defenseType === "dodge") applicable.add("dexterity");
  if (defenseType === "block") applicable.add("resilience");
  let ease = 0, damage = 0;
  for (const category of applicable) {
    const count = shifts[category] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0 || count > 3) return null;
    if (isAttack && ["dexterity", "intelligence", "resilience"].includes(category)) return null;
    if (category === "power") {
      if (!abilitySource) return null;
      damage += count * 3;
    } else if (category === "strength" && isAttack) damage += count * 3;
    else if (category === "singleAttack") {
      if (!isAttack) return null;
      ease += count; damage += count * 3;
    } else {
      if (category === "savant" && (isAttack || defenseType)) return null;
      ease += count;
    }
  }
  return { ease, damage };
}
