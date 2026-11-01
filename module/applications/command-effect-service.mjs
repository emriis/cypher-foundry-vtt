/** Source-scoped consequences for non-damaging command tasks and their paid rerolls. */
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { commandSource } from "./command-power-read.mjs";
import { runActorActions } from "./action-guard.mjs";

/** Validate the complete declared plan before the task engine can spend or roll. */
export function validateCommandEffect(actor, target, effect) {
  if (actor?.type !== "pc" || actor.isOwner === false || target?.type !== "npc" || target.isOwner === false
    || effect.sourceUuid !== actor.uuid || !/^[A-Za-z0-9]+$/.test(effect.id ?? "")) return false;
  if (effect.kind === "calmed") return Boolean(commandSource(actor, effect.itemId, "soothe-the-savage")
    && effect.record?.npcUuid === target.uuid && effect.record.id === effect.id && effect.record.state === "awaiting"
    && effect.record.version === 1 && effect.record.mode === "rest" && effect.record.itemId === effect.itemId && !effect.record.until
    && effect.record.revision === (actor.flags?.cypher?.commandRecoveryRevision ?? 0));
  const ally = actor.flags?.cypher?.teamUpAllies?.[effect.allyId];
  return Boolean(effect.kind === "teamUp" && commandSource(actor, effect.itemId, "team-up-ally")
    && ally?.state === "active" && ally.npcUuid === target.uuid && target.system.level === 4
    && effect.record?.id === effect.id && effect.record.state === "awaiting"
    && target.flags?.cypher?.teamUpAlly?.id === ally.id);
}

/** The source writes these plans together with costs, including an activation reduced to zero by Edge. */
export function commandTaskUpdates(effect) {
  if (effect?.kind === "calmed") return { [`flags.cypher.commandCalms.${effect.id}`]: effect.record };
  if (effect?.kind === "teamUp") return { [`flags.cypher.teamUpAllies.${effect.allyId}.outing`]: effect.record };
  return {};
}

/** Idempotent success settlement; recovery and a later outing prevent old rerolls from renewing effects. */
export async function applyCommandEffect(target, effect, context = null) {
  const owner = await resolveDocumentReference(effect.sourceUuid, "pc");
  if (!owner || owner.isOwner === false || !target || target.isOwner === false) return false;
  return Boolean(await runActorActions([owner, target], "commandEffect", async () => {
    if (effect.kind === "teamUp") {
      const ally = owner.flags?.cypher?.teamUpAllies?.[effect.allyId];
      if (ally?.npcUuid !== target.uuid || ally.outing?.id !== effect.id || !["awaiting", "active"].includes(ally.outing.state)
        || target.system.level !== 4 || !(target.system.health?.value > 0) || target.flags?.cypher?.teamUpAlly?.injured
        || target.flags?.cypher?.teamUpAlly?.id !== ally.id || target.flags.cypher.teamUpAlly.ownerUuid !== owner.uuid) return false;
      if (ally.outing.state !== "active") await owner.update({ [`flags.cypher.teamUpAllies.${ally.id}.outing.state`]: "active" });
      return true;
    }
    const record = owner.flags?.cypher?.commandCalms?.[effect.id];
    if (!record || record.npcUuid !== target.uuid || !["awaiting", "pending", "active"].includes(record.state)
      || record.revision !== (owner.flags?.cypher?.commandRecoveryRevision ?? 0)) return false;
    if (record.state === "active") return true;
    await owner.update({ [`flags.cypher.commandCalms.${record.id}.state`]: "pending" });
    if (target.flags?.cypher?.commandCalms?.[record.id]?.ownerUuid !== owner.uuid) {
      await target.update({ [`flags.cypher.commandCalms.${record.id}`]: { version: 1, ownerUuid: owner.uuid } });
    }
    await owner.update({ [`flags.cypher.commandCalms.${record.id}.state`]: "active" });
    return true;
  }, context));
}
