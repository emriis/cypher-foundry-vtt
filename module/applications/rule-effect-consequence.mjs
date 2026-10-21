/** Attribute successful complementary, draw and guard effects to their original task card. */
import { getGeneralEffects, generalEffectClock } from "./general-effect-service.mjs";
import { generalEffectIsActive } from "../rules/general-effects.mjs";

/** Reject unsupported declarations before dice, costs or target writes. */
export function validateRuleEffect(actor, target, record) {
  return actor?.type === "pc" && actor.isOwner !== false && target?.isOwner !== false
    && target?.uuid === record.targetUuid && record.effect?.sourceUuid === actor.uuid
    && typeof record.effect.id === "string" && record.effect.id.length > 0
    && ["help", "draw", "preventAction"].includes(record.effect.kind)
    && (record.effect.kind === "help" ? target.type === "pc" && record.effect.assets === 1
      : target.type === "npc" && record.effect.actionRevision === (target.flags?.cypher?.weaponActionRevision ?? 0));
}

/**
 * Apply once on success, retaining the original interval across paid rerolls.
 * The origin card is checkpointed by reroll-service before any target write.
 */
export async function applyRuleEffect(target, record, success) {
  if (!success || record.applied || record.state === "pending" || record.state === "manual") return record;
  const effect = record.effect;
  if (!target || target.isOwner === false || target.uuid !== record.targetUuid
    || !generalEffectIsActive(effect, generalEffectClock())
    || (effect.actionRevision != null && effect.actionRevision !== (target.flags?.cypher?.weaponActionRevision ?? 0))) {
    return { ...record, state: "expired" };
  }
  let effects = getGeneralEffects(target);
  if (!effects.some(entry => entry.id === effect.id)) {
    const cancelled = effect.kind === "draw" && effects.some(entry => entry.kind === "draw");
    if (effect.kind === "draw") effects = effects.filter(entry => entry.kind !== "draw");
    await target.update({ "flags.cypher.generalEffects": [...effects, { ...effect, ...(cancelled ? { cancelled: true } : {}) }] });
  }
  return { ...record, applied: true, state: "applied" };
}
