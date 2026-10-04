/**
 * Resolve the deterministic inputs for a defense task.
 *
 * @param {string} defenseType Defense mode.
 * @param {object} armor Armor-derived defense modifiers.
 * @returns {{stat: string, armorModifier: number}}
 */
export function resolveDefense(defenseType, armor = {}) {
  if (defenseType === "block") {
    return {
      stat: "might",
      armorModifier: armor.blockEase ?? 0
    };
  }

  return {
    stat: "speed",
    armorModifier: -(armor.dodgeHinder ?? 0)
  };
}
