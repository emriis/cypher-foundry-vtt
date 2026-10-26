import { applyObjectConsequences } from "./object-service.mjs";
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
export async function applyTaskConsequences(actor, { objectPlan = null, isAttack, success, targetActor, totalDamage,
  armorBypass, weaponTargetEffects, weaponSource, defenseType, applyIncomingWound,
  incomingWounds, usingShield, shieldItem, incomingSeverity, incomingPoolDamage, conditionsOnFailure, woundRemovalSeverity,
  actionContext, defenseRecipient = actor, takeCooldownId = null, specialistRequired = false }) {
  const attack = isAttack && targetActor?.type === "npc"
    ? await applyAttackConsequences(targetActor, { success, totalDamage, armorBypass, weaponTargetEffects, weaponSource })
    : isAttack && targetActor?.type === "object"
      ? await applyObjectConsequences(targetActor, objectPlan, success, totalDamage) : { targetDamage: 0 };

  const defense = defenseType ? await applyDefenseConsequences(defenseRecipient, { defenseType, success: defenseRecipient !== actor ? false : success,
    applyIncomingWound, incomingWounds, usingShield, shieldItem, incomingSeverity, incomingPoolDamage,
    conditionsOnFailure, additionalMinorWound: defenseRecipient !== actor, specialistRequired, actionContext }) : {};
  if (takeCooldownId) defense.defenseConsequences.effects.push(takeCooldownId);
  if (defenseRecipient !== actor) defense.defenseConsequences.success = success;

  const woundRemovalApplied = Boolean(success && woundRemovalSeverity
    && await removeWound(targetActor, woundRemovalSeverity));
  return { ...attack, woundRemovalApplied, shieldWoundsAbsorbed: 0, ...defense };
}
