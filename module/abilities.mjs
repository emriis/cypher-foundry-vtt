/**
 * Resolves standalone ability UUID references stored by Types and Foci.
 *
 * Missing references are ignored so a custom document can remain renderable
 * while a referenced optional pack is unavailable.
 */
import {
  resolveDocumentReferences
} from "./applications/reference-resolver.mjs";

/**
 * Resolve standalone ability UUID references.
 *
 * Ability references are validated at the application boundary so all callers
 * receive actual ability Items and never need to duplicate fromUuid logic.
 */
export async function resolveAbilityReferences(references = []) {
  return resolveDocumentReferences(references, "ability");
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
