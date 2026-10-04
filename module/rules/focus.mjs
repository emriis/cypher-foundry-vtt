/**
 * Determine whether a Focus ability is currently selectable.
 *
 * @param {object} focus Focus graph data.
 * @param {string[]} selectedAbilityIds Previously selected ability ids.
 * @param {string} abilityId Candidate ability id.
 * @param {number} tier Character tier.
 * @returns {boolean} Whether the ability is eligible.
 */
export function isFocusAbilityEligible(
  focus,
  selectedAbilityIds,
  abilityId,
  tier
) {
  const ability = focus?.abilities?.find(
    candidate => candidate.id === abilityId
  );
  if (!ability || ability.tier > tier) return false;

  const selected = new Set(selectedAbilityIds ?? []);
  if (!ability.repeatable && selected.has(ability.id)) return false;
  if (ability.tier === 1) return true;

  return (ability.prerequisites ?? []).some(
    prerequisiteId => selected.has(prerequisiteId)
  );
}

/**
 * List Focus abilities currently selectable.
 *
 * @param {object} focus Focus graph data.
 * @param {string[]} selectedAbilityIds Previously selected ability ids.
 * @param {number} tier Character tier.
 * @returns {object[]} Eligible abilities.
 */
export function getEligibleFocusAbilities(focus, selectedAbilityIds, tier) {
  return (focus?.abilities ?? []).filter(ability =>
    isFocusAbilityEligible(
      focus,
      selectedAbilityIds,
      ability.id,
      tier
    )
  );
}
