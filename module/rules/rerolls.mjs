/**
 * CRD > Spending Experience Points > Rerolling: spend 1 XP, keep the better
 * result, and allow further paid rerolls. Depletion prefers a usable Item;
 * unordered tables require a player's choice, not a numeric ranking.
 */

/**
 * @typedef {object} RerollMetadata
 * @property {string} [rollType]
 * @property {number} [d20]
 * @property {number} [effectiveDifficulty]
 * @property {number} [targetNumber]
 * @property {number} [originalRoll]
 * @property {number} [dieMax]
 * @property {number} [depletionMin]
 * @property {number} [depletionMax]
 * @property {number} [threshold] Legacy upper depletion threshold.
 * @property {string} [rollFormula]
 */

/**
 * Validate stored roll metadata before an application spends XP.
 * Legacy depletion messages use a 1..threshold range; new ones store both ends.
 * @param {RerollMetadata} flags Message metadata.
 * @returns {{kind: string, formula: string, oldValue: number, min: number, max: number}|null} Plan or invalid metadata.
 */
export function resolveRerollPlan(flags) {
  if (flags.rollType === "task") {
    if (!Number.isInteger(flags.d20) || flags.d20 < 1 || flags.d20 > 20
      || !Number.isFinite(flags.effectiveDifficulty) || flags.effectiveDifficulty < 0
      || !Number.isFinite(flags.targetNumber)) return null;
    return { kind: "task", formula: "1d20", oldValue: flags.d20, min: 1, max: 20 };
  }
  if (flags.rollType === "depletion") {
    const min = flags.depletionMin ?? 1;
    const max = flags.depletionMax ?? flags.threshold;
    if (!Number.isInteger(flags.dieMax) || flags.dieMax < 1
      || !Number.isInteger(flags.originalRoll) || flags.originalRoll < 1 || flags.originalRoll > flags.dieMax
      || !Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > flags.dieMax) return null;
    return { kind: "depletion", formula: `1d${flags.dieMax}`, oldValue: flags.originalRoll, min, max };
  }
  if (!["recovery", "cypherTable", "cypherVariant"].includes(flags.rollType)
    || !Number.isFinite(flags.originalRoll) || typeof flags.rollFormula !== "string" || !flags.rollFormula.trim()) return null;
  return { kind: flags.rollType, formula: flags.rollFormula, oldValue: flags.originalRoll, min: 0, max: 0 };
}

/**
 * Select a result using its consequence, not just its numeric size.
 * Tables/variants have no source-defined numeric ordering: an absent choice
 * keeps the old result, while "new" explicitly selects the rerolled result.
 * @param {NonNullable<ReturnType<typeof resolveRerollPlan>>} plan Validated plan.
 * @param {number} newValue Evaluated die total.
 * @param {string|null} [choice=null] Player choice for unordered outcomes.
 * @returns {number} Retained total for the next reroll.
 */
export function selectRerollValue(plan, newValue, choice = null) {
  if (plan.kind === "cypherTable" || plan.kind === "cypherVariant") {
    return choice === "new" ? newValue : plan.oldValue;
  }
  if (plan.kind === "depletion") {
    const depleted = value => value >= plan.min && value <= plan.max;
    if (depleted(plan.oldValue) !== depleted(newValue)) {
      return depleted(newValue) ? plan.oldValue : newValue;
    }
  }
  return Math.max(plan.oldValue, newValue);
}
