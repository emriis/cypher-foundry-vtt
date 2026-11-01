/** Source-linked temporary NPC projections; never mutate during preparation. */
import { temporaryFollowerActive, temporaryFollowerPlan, temporaryCopyActive } from "../rules/temporary-followers.mjs";
import { resolveCachedDocumentReference } from "./reference-resolver.mjs";
export const temporaryFollowers = actor => Object.values(actor?.flags?.cypher?.temporaryFollowers ?? {}).filter(record => record?.version === 1);
export const temporaryUses = actor => Object.values(actor?.flags?.cypher?.temporaryUses ?? {}).filter(record => record?.version === 1);
export const temporaryAbilityIdentity = item => item?.flags?.cypherFoundry?.crd?.sourceLogicalId ?? item?.flags?.cypherFoundry?.crd?.logicalId ?? null;

/** Canonical source provenance, rather than names or a guessed Basic Necromancy variant. */
export function temporaryAbilityPlan(item, options = {}) {
  if (item?.type !== "ability") return null;
  return temporaryFollowerPlan(item.system?.key, { ...options, identity: temporaryAbilityIdentity(item) });
}

/** The actual target retains its reverse link; a removed/mismatched owner grants no control. */
export function temporaryNpcLink(npc) {
  const link = npc?.flags?.cypher?.temporaryFollower;
  if (link?.version !== 1) return null;
  const owner = resolveCachedDocumentReference(link.ownerUuid), record = owner?.flags?.cypher?.temporaryFollowers?.[link.id];
  return record?.npcUuid === npc.uuid ? { owner, record } : { owner, record: null };
}

/** Recompiled machines resume ordinary behavior on expiry; inert undead and dissipated doubles cannot act. */
export function temporaryNpcAvailability(npc) {
  const link = temporaryNpcLink(npc);
  if (!link) return null;
  const { owner, record } = link;
  if (!record) return npc.flags.cypher.temporaryFollower.family === "machine" ? null : false;
  const active = temporaryFollowerActive(record, owner.flags?.cypher);
  if (record.family === "machine" && record.revision !== (owner.flags?.cypher?.temporaryRecoveries?.[record.recovery] ?? 0)) return null;
  if (record.family === "machine" && !active && ["ended", "killed"].includes(record.state)) return null;
  return active && record.mode === "independent" && npc.system.health?.value > 0
    && !["unconscious", "dead", "stunned", "paralyzed"].some(status => npc.statuses?.has(status));
}

/** Block every action during a reboot or while an animated body has become inert. */
export function temporaryNpcBlocked(npc) {
  const link = temporaryNpcLink(npc);
  if (!link) return false;
  if (!link.record) return npc.flags.cypher.temporaryFollower.family !== "machine";
  if (link.record.family === "machine" && link.record.revision !== (link.owner.flags?.cypher?.temporaryRecoveries?.[link.record.recovery] ?? 0)) return false;
  return !temporaryFollowerActive(link.record, link.owner.flags?.cypher);
}

/** Copied equipment remains a retained tombstone so a corrected death can restore exactly those copies. */
export function temporaryEquipmentUsable(item) {
  const copy = item?.flags?.cypher?.temporaryEquipment;
  if (!copy) return true;
  const owner = resolveCachedDocumentReference(copy.ownerUuid), record = owner?.flags?.cypher?.temporaryFollowers?.[copy.id];
  return Boolean(record && temporaryCopyActive(item, owner.flags?.cypher));
}

/** Rendering the NPC as absent is distinct from deleting its retained acquired loot and reroll history. */
export function temporaryNpcVisible(npc) {
  const link = temporaryNpcLink(npc);
  if (!link?.record && npc?.flags?.cypher?.temporaryFollower?.family === "duplicate") return false;
  return !link?.record || link.record.family !== "duplicate" || temporaryFollowerActive(link.record, link.owner.flags?.cypher);
}

/** These rows join ordinary follower selection and its shared two-asset cap, without permanent tier receipts. */
export function temporaryFollowerRows(actor, effectsBlocked = () => false) {
  return temporaryFollowers(actor).map(record => {
    const npc = resolveCachedDocumentReference(record.npcUuid), active = temporaryFollowerActive(record, actor.flags?.cypher);
    const linked = npc?.flags?.cypher?.temporaryFollower?.id === record.id;
    const disabled = effectsBlocked(npc) || ["unconscious", "dead", "stunned", "paralyzed"].some(status => npc?.statuses?.has(status));
    return { ...record, temporary: true, dismissible: record.family === "duplicate" && active, name: npc?.name ?? record.npcUuid, level: npc?.system.level ?? record.level, health: npc?.system.health,
      pending: record.state === "pending" || record.state === "rebooting", available: active && linked, unavailable: !active || !linked || disabled,
      modeLabel: `CYPHER.Follower.${record.mode}`, stateLabel: `CYPHER.Temporary.${record.revision !== (actor.flags?.cypher?.temporaryRecoveries?.[record.recovery] ?? 0) ? "expired" : record.state}`,
      canHelp: active && linked && !disabled && npc?.system.health?.value > 0 && record.mode !== "independent", tasks: [] };
  });
}
