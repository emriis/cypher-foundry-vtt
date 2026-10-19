/** Persist target and defense consequences before publishing a successful chat result. */
import { addWound, applyNpcDamage, reduceWound, shieldAbsorbWound } from "./damage-service.mjs";
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
  incomingWounds, usingShield, shieldItem, incomingSeverity, woundRemovalSeverity, actionContext }) {
  // Apply target-side consequences only after a successful attack.
  let targetDamage = 0;
  let shieldWoundsAbsorbed = 0;
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

  // Resolve the wound based on the defense result.
  if (defenseType) {
    if (success) {
      if (applyIncomingWound && defenseType === "block") {
        for (let index = 0; index < incomingWounds; index += 1) {
          if (usingShield && await shieldAbsorbWound(actor, shieldItem, incomingSeverity, actionContext)) {
            shieldWoundsAbsorbed++;
          } else {
            const reduced = reduceWound(incomingSeverity);
            if (reduced) await addWound(actor, reduced);
          }
        }
      }
      // A successful Dodge avoids the wound entirely.
    } else if (applyIncomingWound) {
      for (let index = 0; index < incomingWounds; index += 1) {
        await addWound(actor, incomingSeverity);
      }
    }
  }

  const woundRemovalApplied = Boolean(success && woundRemovalSeverity
    && await removeWound(targetActor, woundRemovalSeverity));
  return { targetDamage, woundRemovalApplied, shieldWoundsAbsorbed };
}
