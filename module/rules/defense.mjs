/**
 * Resolve the deterministic inputs for a defense task.
 *
 * @param {string} defenseType Defense mode.
 * @param {object} armor Armor-derived defense modifiers.
 * @returns {{stat: string, armorModifier: number}}
 */
export function resolveDefense(defenseType, armor = {}) {
  if (["might", "speed", "intellect"].includes(defenseType)) return { stat: defenseType, armorModifier: 0 };
  if (defenseType === "block") {
    return {
      stat: "might",
      armorModifier: armor.blockEase ?? 0
    };
  }

  const dodgeHinder = armor.dodgeHinder ?? 0;

  return {
    stat: "speed",
    armorModifier: dodgeHinder === 0 ? 0 : -dodgeHinder
  };
}
