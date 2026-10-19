/** Persist target and defense consequences before publishing a successful chat result. */
import { applyNpcDamage } from "./damage-service.mjs";
import { applyDefenseConsequences } from "./defense-consequence-service.mjs";
import { applyWeaponTargetEffects } from "./weapon-effect-service.mjs";
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
  // Apply target-side consequences only after a successful attack.
  let targetDamage = 0;
  if (isAttack && success && targetActor?.type === "npc") {
    if (totalDamage > 0) {
      targetDamage = await applyNpcDamage(targetActor, totalDamage, {
        armorBypass
      });
    }
    await applyWeaponTargetEffects(
      targetActor,
      weaponTargetEffects,
      weaponSource
    );
  }

  const defense = defenseType ? await applyDefenseConsequences(actor, { defenseType, success,
    applyIncomingWound, incomingWounds, usingShield, shieldItem, incomingSeverity, incomingPoolDamage, actionContext }) : {};

  const woundRemovalApplied = Boolean(success && woundRemovalSeverity
    && await removeWound(targetActor, woundRemovalSeverity));
  return { targetDamage, woundRemovalApplied, shieldWoundsAbsorbed: 0, ...defense };
}
