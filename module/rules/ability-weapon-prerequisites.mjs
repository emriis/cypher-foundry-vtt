/**
 * Resolves source-declared weapon prerequisites for an ability.
 *
 * Requirements in the same alternativeGroup are alternatives (OR). Distinct
 * groups are cumulative (AND). Context must be supplied by the caller; this
 * resolver never guesses reach, weapon type, or ammunition state.
 */

function requirementMatches(requirement, context) {
  const weapon = context.weapon ?? {};
  const mechanics = weapon.mechanics ?? context.weaponMechanics ?? {};

  switch (requirement.kind) {
    case "rapidFire":
      return mechanics.rapidFire === true;
    case "thrownWeaponsInReach":
      return context.thrownWeaponsInReach === true;
    case "weaponCategory":
      return (weapon.attackType ?? context.weaponCategory) === requirement.value;
    case "weaponFamily":
      return (weapon.weaponFamily ?? context.weaponFamily) === requirement.value;
    default:
      return false;
  }
}

/**
 * Determine whether the supplied context satisfies an ability's prerequisites.
 *
 * @param {Array<object>} prerequisites Structured ability prerequisites.
 * @param {object} context Explicitly established weapon/use context.
 * @returns {{eligible: boolean, unmetGroups: string[]}}
 */
export function resolveWeaponPrerequisites(prerequisites, context = {}) {
  if (!Array.isArray(prerequisites) || prerequisites.length === 0) {
    return { eligible: true, unmetGroups: [] };
  }

  const groups = new Map();
  for (const requirement of prerequisites) {
    if (!requirement || typeof requirement.alternativeGroup !== "string" ||
        requirement.alternativeGroup.length === 0) {
      return { eligible: false, unmetGroups: ["invalid-prerequisites"] };
    }
    const group = groups.get(requirement.alternativeGroup) ?? [];
    group.push(requirement);
    groups.set(requirement.alternativeGroup, group);
  }

  const unmetGroups = [];
  for (const [groupName, alternatives] of groups) {
    if (!alternatives.some(requirement =>
      requirementMatches(requirement, context)
    )) {
      unmetGroups.push(groupName);
    }
  }

  return { eligible: unmetGroups.length === 0, unmetGroups };
}
