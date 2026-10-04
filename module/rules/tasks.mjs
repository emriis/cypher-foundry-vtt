import { CYPHER } from "../config.mjs";

/**
 * Compute the Pool cost of Effort after applying Edge once to the total cost.
 *
 * @param {number} levels Number of Effort levels spent.
 * @param {number} edge Edge available on the relevant Pool.
 * @returns {number} Pool points required.
 */
export function computeEffortCost(levels, edge = 0) {
  if (levels <= 0) return 0;

  const total =
    CYPHER.effortCostFirstLevel +
    (levels - 1) * CYPHER.effortCostAdditionalLevel;

  return Math.max(0, total - edge);
}

/**
 * Clamp Effort to the character's available Effort and system ceiling.
 *
 * @param {number} levels Requested Effort levels.
 * @param {number} effort Character Effort score.
 * @param {number} maximum Maximum supported Effort level.
 * @returns {number} Validated Effort level count.
 */
export function clampEffortLevels(levels, effort, maximum = 6) {
  return Math.min(effort, maximum, Math.max(0, levels));
}

/**
 * Clamp Asset steps to the two-step Asset limit.
 *
 * @param {number} steps Requested Asset steps.
 * @returns {number} Validated Asset steps.
 */
export function clampAssetSteps(steps) {
  return Math.min(2, Math.max(0, steps));
}

/**
 * Combine all task step modifiers into a single net step adjustment.
 *
 * @param {object} options Task step modifiers.
 * @returns {number} Net task step adjustment.
 */
export function computeTaskSteps({
  effortLevels = 0,
  assetSteps = 0,
  skillSteps = 0,
  extraEaseSteps = 0,
  woundHinder = 0,
  extraHinderSteps = 0,
  armorModifier = 0,
  autoArmorSpeedHinder = 0
} = {}) {
  return (
    effortLevels +
    assetSteps +
    skillSteps +
    extraEaseSteps -
    woundHinder -
    extraHinderSteps +
    armorModifier -
    autoArmorSpeedHinder
  );
}

/**
 * Resolve a task difficulty after applying its net step adjustment.
 *
 * @param {number} difficulty Base difficulty.
 * @param {number} steps Net task step adjustment.
 * @returns {{effectiveDifficulty: number, targetNumber: number}}
 */
export function resolveTaskDifficulty(difficulty, steps) {
  const effectiveDifficulty = Math.max(0, difficulty - steps);

  return {
    effectiveDifficulty,
    targetNumber: effectiveDifficulty * 3
  };
}
