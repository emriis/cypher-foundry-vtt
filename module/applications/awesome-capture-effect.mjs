/** Original barrier identity, containment receipts and the shared first-action refund. */
import { awesomeBarrierObstructs } from "./awesome-field-read.mjs";
import { resolveDocumentReference, resolveCachedDocumentReference } from "./reference-resolver.mjs";
import { roundActionContext } from "./round-action-service.mjs";
import { runActorActions } from "./action-guard.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
const allowed = actor => actor?.type === "pc" && actor.isOwner !== false && game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const items = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);
/** Only the initially declared NPCs may be attacked for containment, once each during the creation action. */
export function validateAwesomeCapture(actor, target, effect) {
  const field = actor?.flags?.cypher?.awesomeBarriers?.[effect?.fieldId], entry = field?.targets?.find(entry => entry.id === effect.targetId);
  const object = field && resolveCachedDocumentReference(field.objectUuid);
  const source = actor?.items?.get?.(field?.itemId);
  const round = roundActionContext(actor, { isAttack: true, extraAction: true, extraActionSource: "awesome-capture" });
  return allowed(actor) && target?.type === "npc" && target.isOwner !== false && source?.type === "ability" && source.system.key === "awesome-force-field"
    && target.system.health?.value > 0 && object && awesomeBarrierObstructs(object) && entry?.uuid === target.uuid && entry.state === "awaiting"
    && (!field.actionStamp || round?.kind && round.combat.id === field.actionStamp.combatId && round.step.id === field.actionStamp.stepId);
}

/** One target receipt, then the source acknowledgement; successful paid rerolls retain the original barrier identity. */
export async function applyAwesomeCapture(target, effect, context = null) {
  const owner = await resolveDocumentReference(effect.sourceUuid, "pc"), field = owner?.flags?.cypher?.awesomeBarriers?.[effect.fieldId];
  const entry = field?.targets?.find(entry => entry.id === effect.targetId), object = field && resolveCachedDocumentReference(field.objectUuid);
  if (!owner || owner.isOwner === false || !entry || entry.uuid !== target?.uuid || target.isOwner === false || !object || !awesomeBarrierObstructs(object)
    || !["rolling", "complete"].includes(entry.state)) return false;
  const prior = target.flags?.cypher?.awesomeContainments?.[effect.targetId];
  if (prior?.released) return false;
  return Boolean(await runActorActions([owner, target], "awesomeCaptureApply", async () => {
    if (!prior) await target.update({ [`flags.cypher.awesomeContainments.${effect.targetId}`]: { version: 1, id: effect.targetId, ownerUuid: owner.uuid, fieldId: field.id, released: false } });
    await owner.update({ [`flags.cypher.awesomeBarriers.${field.id}.targets`]: field.targets.map(target => target.id === entry.id ? { ...target, state: "complete", success: true, ...(effect.note ? { note: effect.note } : {}) } : target) });
    return true;
  }, context));
}

/** The field's dedicated Effort belongs to the first trapping action; refund it once on a retained 20. */
export async function refundAwesomeCreation(actor, effect) {
  if (!effect?.first) return;
  const field = actor.flags?.cypher?.awesomeBarriers?.[effect.fieldId];
  if (!field || field.refunded || field.targets[0]?.id !== effect.targetId) return;
  const modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, items(actor), actor.system);
  const pool = actor.system.stats.intellect.pool;
  await actor.update({ "system.stats.intellect.pool.value": Math.min(pool.max + (modifiers.poolMax.intellect ?? 0), pool.value + field.cost),
    [`flags.cypher.awesomeBarriers.${field.id}.refunded`]: true });
}

