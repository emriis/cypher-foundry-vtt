/**
 * Return the localized label for an Ability's activation type.
 *
 * @param {object} ability Ability system data.
 * @param {Function} localize Localization function.
 * @returns {string} Localized activation label.
 */
export function abilityActionLabel(ability, localize) {
  if (ability.enabler) return localize("CYPHER.Ability.ActionEnabler");
  switch (ability.action) {
    case "firstAction":
      return localize("CYPHER.Ability.ActionFirst");
    case "lastAction":
      return localize("CYPHER.Ability.ActionLast");
    case "action":
      return localize("CYPHER.Ability.ActionStandard");
    default:
      return "";
  }
}
