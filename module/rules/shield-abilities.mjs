/** Source-bound shield exceptions; no Foundry state or localized-name matching. */
export const SHIELD_ABILITY_KEYS = ["unyielding-shield", "hidden-shield", "throw-shield", "bouncing-shield"];

/** Resolve a designated shield's special Ability from its actual owner's inventory. */
export function shieldAbilityKind(shield, items = []) {
  const ability = items.find(item => item.id === shield?.system?.abilityItemId && item.type === "ability");
  return ["unyielding-shield", "hidden-shield"].includes(ability?.system?.key) ? ability.system.key : null;
}

/** Only the first and third Bouncing Shield targets may be the same creature. */
export function validShieldTargets(kind, ids) {
  if (kind !== "bouncing-shield") return ids.length === 1 && Boolean(ids[0]);
  return ids.length === 3 && ids.every(Boolean) && ids[0] !== ids[1] && ids[1] !== ids[2];
}

/** CRD 3425: destruction is replaced by losing the next turn (or a GM intrusion). */
export function shieldSurvivesMajor(shield, items = []) {
  return shieldAbilityKind(shield, items) === "unyielding-shield";
}

/** Read an Item-shaped owner's inventory without depending on Foundry globals. */
export function shieldOwnerItems(shield) {
  const items = shield?.actor?.items;
  return items?.contents ?? (Array.isArray(items) ? items : Array.from(items?.values?.() ?? []));
}
