/** Persist target and defense consequences before publishing a successful chat result. */
import { applyAttackConsequences } from "./attack-consequence-service.mjs";
import { applyDefenseConsequences } from "./defense-consequence-service.mjs";
import { removeWound } from "./wound-removal.mjs";
/**
 * Await writes in gameplay order; propagate failure without stale rollback.
 * @param {Actor} actor PC performing the task or defense.
 * @param {object} context Resolved attack/defense context.
 * @returns {Promise<object>} Applied damage, wound removal, and actual shield absorption count.
 */
export async function applyTaskConsequences(actor, { isAttack, success, targetActor, totalDamage,
  armorBypass, weaponTargetEffects, weaponSource, defenseType, applyIncomingWound,
  incomingWounds, usingShield, shieldItem, incomingSeverity, incomingPoolDamage, woundRemovalSeverity, actionContext }) {
  const attack = isAttack && targetActor?.type === "npc"
    ? await applyAttackConsequences(targetActor, { success, totalDamage, armorBypass, weaponTargetEffects, weaponSource })
    : { targetDamage: 0 };

  const defense = defenseType ? await applyDefenseConsequences(actor, { defenseType, success,
    applyIncomingWound, incomingWounds, usingShield, shieldItem, incomingSeverity, incomingPoolDamage, actionContext }) : {};

  const woundRemovalApplied = Boolean(success && woundRemovalSeverity
    && await removeWound(targetActor, woundRemovalSeverity));
  return { ...attack, woundRemovalApplied, shieldWoundsAbsorbed: 0, ...defense };
}
