/**
 * Store which Ability effects are active on a player character.
 * An active entry is a reference (Item UUID + effect ID), not a copy of the
 * modifiers. The rules layer reads the referenced Ability to calculate bonuses.
 * These functions persist state; they do not roll dice or charge activation costs.
 */
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { abilityEffectEndsOnRecovery } from "../rules/ability-effects.mjs";

/**
 * Add one actor-owned effect reference, refusing duplicate activations.
 *
 * @param {Actor} actor PC that will own the active reference.
 * @param {Item} abilityItem Ability embedded in that same Actor.
 * @param {string} effectId Identifier within the Ability's effects array.
 * @returns {Promise<boolean>} True after persistence; false for invalid or duplicate input.
 */
export async function activateAbilityEffect(actor, abilityItem, effectId) {
  if (
    actor?.type !== "pc"
    || abilityItem?.type !== "ability"
    || abilityItem.parent !== actor
  ) return false;

  const effect = (abilityItem.system.effects ?? [])
    .find(candidate => candidate.id === effectId);
  if (!effect) return false;

  const activeEffects = actor.system.activeAbilityEffects ?? [];
  const exists = activeEffects.some(active =>
    active.itemUuid === abilityItem.uuid && active.effectId === effectId
  );
  if (exists) return false;

  await actor.update({
    "system.activeAbilityEffects": [
      ...activeEffects,
      { itemUuid: abilityItem.uuid, effectId }
    ]
  });
  return true;
}

/**
 * Remove a specific reference without deactivating other effects from the Item.
 *
 * @param {Actor} actor PC that owns the active references.
 * @param {string} itemUuid Foundry UUID of the source Ability.
 * @param {string} effectId Identifier within that Ability.
 * @returns {Promise<boolean>} Whether an active reference was removed.
 */
export async function deactivateAbilityEffect(actor, itemUuid, effectId) {
  if (actor?.type !== "pc") return false;

  const activeEffects = actor.system.activeAbilityEffects ?? [];
  const remaining = activeEffects.filter(active =>
    !(active.itemUuid === itemUuid && active.effectId === effectId)
  );
  if (remaining.length === activeEffects.length) return false;

  await actor.update({
    "system.activeAbilityEffects": remaining
  });
  return true;
}

/**
 * Remove effects whose declared end conditions match a completed recovery.
 * Unresolvable references are retained: a missing source is not evidence that
 * its effect should expire. Only resolved, matching conditions cause a write.
 *
 * @param {Actor} actor PC completing the recovery.
 * @param {string} recoveryInterval Recovery key, such as "hour".
 * @returns {Promise<number>} Number of references removed.
 */
export async function expireAbilityEffectsOnRecovery(
  actor,
  recoveryInterval
) {
  if (actor?.type !== "pc") return 0;

  const activeEffects = actor.system.activeAbilityEffects ?? [];
  if (!activeEffects.length) return 0;

  const remaining = [];
  let expiredCount = 0;

  for (const active of activeEffects) {
    const abilityItem = await resolveDocumentReference(
      active.itemUuid,
      "ability"
    );
    const effect = abilityItem?.system?.effects?.find(
      candidate => candidate.id === active.effectId
    );

    if (!abilityItem || !effect) {
      remaining.push(active);
      continue;
    }

    if (abilityEffectEndsOnRecovery(effect, recoveryInterval)) {
      expiredCount += 1;
      continue;
    }

    remaining.push(active);
  }

  if (expiredCount) {
    await actor.update({
      "system.activeAbilityEffects": remaining
    });
  }

  return expiredCount;
}
