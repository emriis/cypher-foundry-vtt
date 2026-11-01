/** Recompile Machine companion branch; source-scoped writes shared by initial attacks and paid rerolls. */
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { runActorActions } from "./action-guard.mjs";
import { temporaryFollowerActive } from "../rules/temporary-followers.mjs";

/** Source and planned target must still match before this ability can enter the task pipeline. */
export function validateRecompileEffect(actor, target, effect) {
  const record = effect?.record ?? actor?.flags?.cypher?.temporaryFollowers?.[effect?.recordId];
  return game.user?.isGM && game.users?.activeGM?.id === game.user.id && target?.type === "npc" && target.isOwner !== false
    && actor.items?.get?.(effect.sourceItemId)?.system?.key === "recompile-machine"
    && effect.sourceUuid === actor.uuid && record?.id === effect.recordId && /^[A-Za-z0-9]+$/.test(record.id)
    && record.npcUuid === target.uuid && record.sourceItemId === effect.sourceItemId && record.key === "recompile-machine"
    && record.state === "awaiting" && record.level === target.system.level && target.system.level <= record.maximumLevel;
}

/** The paid attack's plan survives loss of a later NPC/PC acknowledgement; effects never reset Health. */
export async function applyRecompileEffect(target, effect, context = null) {
  const owner = await resolveDocumentReference(effect.sourceUuid, "pc");
  const record = owner?.flags?.cypher?.temporaryFollowers?.[effect.recordId];
  if (!owner || owner.isOwner === false || target?.isOwner === false || !record || record.npcUuid !== target.uuid) return false;
  if (target.system.level !== record.level || target.system.level > record.maximumLevel) return false;
  const current = target.flags?.cypher?.temporaryFollower;
  if (target.flags?.cypher?.followerProgress || current && current.ownerUuid !== owner.uuid
    || current?.id !== record.id && (current?.id ?? null) !== record.previousId) return false;
  if (!temporaryFollowerActive({ ...record, state: "active" }, owner.flags?.cypher)) return false;
  if (["active", "rebooting"].includes(record.state)) return true;
  if (!["awaiting", "pending"].includes(record.state)) return false;
  return Boolean(await runActorActions([owner, target], "temporaryMachineEffect", async () => {
    await owner.update({ [`flags.cypher.temporaryFollowers.${record.id}.state`]: "pending" });
    const link = target.flags?.cypher?.temporaryFollower;
    if (link?.id !== record.id) await target.update({ "flags.cypher.temporaryFollower": { version: 1, ownerUuid: owner.uuid, id: record.id, family: "machine" } });
    // The original attack fixes this interval. Retrying an uncertain write or
    // paying for another die never starts an additional reboot countdown.
    const finished = record.combatId && game.combat?.id === record.combatId && game.combat.round >= record.readyRound;
    await owner.update({ [`flags.cypher.temporaryFollowers.${record.id}.state`]: finished ? "active" : "rebooting",
      ...(record.previousId ? { [`flags.cypher.temporaryFollowers.${record.previousId}.state`]: "ended" } : {}),
      [`flags.cypher.temporaryFollowers.${record.id}.combatId`]: record.combatId ?? null,
      [`flags.cypher.temporaryFollowers.${record.id}.readyRound`]: record.readyRound ?? null });
    return true;
  }, context));
}
