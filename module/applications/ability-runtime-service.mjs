import { resolveDocumentReference } from "./reference-resolver.mjs";
import { abilityEffectEndsOnRecovery } from "../rules/ability-effects.mjs";

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
