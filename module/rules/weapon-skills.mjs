import { CYPHER } from "../config.mjs";

/**
 * Resolve the task-step modifier contributed by weapon familiarity and a
 * matching attack skill.
 *
 * An unfamiliar weapon is an inability (-1). A matching attack skill can
 * cancel that inability or provide additional training, but the same
 * inability must never be counted twice.
 *
 * @param {object} options Weapon skill inputs.
 * @param {boolean} [options.familiar=false] Whether the weapon is freely usable.
 * @param {string|null} [options.skillLevel=null] Matching attack skill level.
 * @returns {number} Net ease/hindrance steps from weapon proficiency.
 */
export function resolveWeaponSkillModifier({
  familiar = false,
  skillLevel = null
} = {}) {
  const skillSteps = CYPHER.skillLevels[skillLevel] ?? null;

  if (skillSteps === null) {
    return familiar ? 0 : -1;
  }

  if (skillLevel === "practiced") return 0;

  const familiarityModifier = familiar ? 0 : -1;
  return Math.max(-1, skillSteps + familiarityModifier);
}
