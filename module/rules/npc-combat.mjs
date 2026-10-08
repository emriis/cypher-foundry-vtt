/**
 * Pure resolution helpers for NPC combat data.
 *
 * These helpers only resolve mechanics represented by structured NPC data.
 * Descriptive combat prose remains outside this module.
 */

/**
 * Resolve numeric damage against NPC Health after Armor and Armor bypass.
 *
 * @param {number} amount Incoming numeric damage.
 * @param {number} armor Target Armor.
 * @param {number} [armorBypass=0] Points of Armor ignored by the attack.
 * @returns {number} Damage reaching Health.
 */
export function resolveNpcHealthDamage(amount, armor = 0, armorBypass = 0) {
  const damage = Math.max(0, Number(amount));
  const targetArmor = Math.max(0, Number(armor));
  const bypass = Math.max(0, Number(armorBypass));
  return Math.max(0, damage - Math.max(0, targetArmor - bypass));
}

/**
 * Normalize a structured NPC attack's damage profile.
 *
 * @param {object} attack Structured NPC attack.
 * @returns {object} Normalized damage profile.
 */
export function normalizeNpcAttackDamage(attack = {}) {
  const damage = attack.damage ?? {};
  return {
    mode: damage.mode ?? "numeric",
    amount: Math.max(0, Number(damage.amount ?? 0)),
    severity: damage.severity ?? "",
    stat: damage.stat ?? "",
    ignoresArmor: Math.max(0, Number(damage.ignoresArmor ?? 0)),
    wounds: Math.max(1, Number(damage.wounds ?? 1))
  };
}

/**
 * Determine whether a structured NPC attack contains enough data for
 * automatic numeric Health damage.
 *
 * Wound and Pool damage are intentionally not applied here: NPCs can inflict
 * those effects on player characters, but that requires a target-side
 * contract distinct from NPC Health persistence.
 *
 * @param {object} attack Structured NPC attack.
 * @returns {boolean} Whether numeric Health damage can be resolved.
 */
export function canApplyNpcHealthDamage(attack = {}) {
  const damage = normalizeNpcAttackDamage(attack);
  return damage.mode === "numeric" && damage.amount > 0;
}
