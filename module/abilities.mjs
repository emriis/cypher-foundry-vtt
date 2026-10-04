/**
 * Resolves standalone ability UUID references stored by Types and Foci.
 *
 * Missing references are ignored so a custom document can remain renderable
 * while a referenced optional pack is unavailable.
 */
export async function resolveAbilityReferences(references = []) {
  const documents = await Promise.all(
    references.map(uuid => fromUuid(uuid).catch(() => null))
  );
  return documents.filter(document => document?.type === "ability");
}

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
