/** Resolve a d20 task's CRD outcome once, for both initial rolls and rerolls. */
import { resolveAttackDamage, resolveSpecialRoll } from "./tasks.mjs";

/**
 * Resolve success, special effects, refunds, and numeric attack damage.
 * Natural 19/20 damage is an explicit choice instead of an automatic bonus.
 * @param {object} input Task outcome inputs.
 * @param {number|null} input.d20 Natural die result, or null for routine success without dice.
 * @param {number} input.effectiveDifficulty Difficulty after task modifiers.
 * @param {boolean} [input.isAttack=false] Whether this is an attack.
 * @param {number} [input.baseDamage=0] Weapon damage before the special result.
 * @param {string|null} [input.specialEffectChoice=null] "damage", "minor", or "major".
 * @returns {{success: boolean, special: ReturnType<typeof resolveSpecialRoll>, damageBonus: number, selectedEffect: string|null, totalDamage: number}} Resolved outcome.
 */
export function resolveTaskOutcome({ d20, effectiveDifficulty, isAttack = false,
  baseDamage = 0, specialEffectChoice = null }) {
  const success = effectiveDifficulty <= 0 || (d20 !== null && d20 >= effectiveDifficulty * 3);
  const special = resolveSpecialRoll({ d20, success, isAttack,
    inflictsDamage: isAttack && success && baseDamage > 0 });
  let damageBonus = special.damageBonus;
  let selectedEffect = special.effect;
  if (special.effectOptions.includes(specialEffectChoice)) {
    if (specialEffectChoice === "damage") damageBonus = d20 === 19 ? 3 : 4;
    else selectedEffect = specialEffectChoice;
  }
  return { success, special, damageBonus, selectedEffect,
    totalDamage: isAttack ? resolveAttackDamage(success, baseDamage, damageBonus) : 0 };
}
