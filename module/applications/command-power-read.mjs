/** Read-only source-qualified command effects, shared by sheets, tasks and companion benefits. */
import { calmActive } from "../rules/command-powers.mjs";
import { resolveCachedDocumentReference } from "./reference-resolver.mjs";
export const COMMAND_KEYS = ["soothe-the-savage", "lighting-a-fire-under-them", "team-up-ally"];
export const commandRecords = actor => Object.values(actor?.flags?.cypher?.commandCalms ?? {}).filter(record => record?.version === 1);
export const teamUpRecords = actor => Object.values(actor?.flags?.cypher?.teamUpAllies ?? {}).filter(record => record?.version === 1);
export const commandSource = (actor, id, key) => {
  const item = actor?.items?.get?.(id);
  return item?.type === "ability" && item.system.key === key && item.isOwner !== false ? item : null;
};
export const commandClock = () => ({ id: game.combat?.id, revisions: game.combat?.flags?.cypher?.turnRevisions ?? {} });

/** Calming does not itself establish friendly disposition or ownership. Both are separate declarations. */
export function hasActiveCalm(actor, npc) {
  return commandRecords(actor).some(record => record.npcUuid === npc?.uuid
    && npc.flags?.cypher?.commandCalms?.[record.id]?.ownerUuid === actor.uuid
    && calmActive(record, actor.flags?.cypher?.commandRecoveryRevision ?? 0, commandClock()));
}

/** NPC-side control is available only for the outing whose charm roll actually succeeded. */
export function teamUpAvailability(npc) {
  const link = npc?.flags?.cypher?.teamUpAlly;
  if (!link) return null;
  const owner = resolveCachedDocumentReference(link.ownerUuid), record = owner?.flags?.cypher?.teamUpAllies?.[link.id];
  return Boolean(record?.npcUuid === npc.uuid && record.state === "active" && record.outing?.state === "active"
    && npc.system.level === 4 && npc.system.health?.value > 0 && !link.injured && record.mode === "independent"
    && !["dead", "unconscious", "stunned", "paralyzed"].some(kind => npc.statuses?.has(kind)));
}

/** Fixed level four; no durable follower progression is borrowed for this NPC ally. */
export function teamUpRows(actor, blocked = () => false) {
  return teamUpRecords(actor).map(record => {
    const npc = resolveCachedDocumentReference(record.npcUuid);
    const linked = npc?.flags?.cypher?.teamUpAlly?.id === record.id && npc.flags.cypher.teamUpAlly.ownerUuid === actor.uuid;
    const available = record.state === "active" && linked && npc.system.level === 4 && record.outing?.state === "active"
      && npc.system.health?.value > 0 && !npc.flags.cypher.teamUpAlly.injured && !blocked(npc) && !["dead", "unconscious", "stunned", "paralyzed"].some(kind => npc.statuses?.has(kind));
    return { ...record, teamUp: true, name: npc?.name ?? record.npcUuid, level: npc?.system.level, health: npc?.system.health,
      pending: record.state === "pending", unavailable: !available, canHelp: available && record.mode !== "independent",
      tasks: record.taskLevels, modeLabel: `CYPHER.Follower.${record.mode}`, stateLabel: `CYPHER.Command.${available ? "accompanying" : "absent"}` };
  });
}

/** Supposedly killed allies are injured, not lost; ordinary healing alone cannot bypass their care project. */
export function stampTeamUpInjury(npc, changes) {
  const value = changes["system.health.value"] ?? changes.system?.health?.value;
  if (npc?.type === "npc" && npc.flags?.cypher?.teamUpAlly && value !== undefined && Number(value) === 0) {
    changes["flags.cypher.teamUpAlly.injured"] = true;
  }
}

/** Sheet projections retain pending grants and expired calm records for explicit review/end controls. */
export function commandDisplay(actor) {
  return { choices: (actor.items?.contents ?? Array.from(actor.items?.values?.() ?? [])).filter(item => item.type === "ability" && COMMAND_KEYS.includes(item.system.key))
    .map(item => ({ id: item.id, name: item.name })), allies: teamUpRows(actor),
    calms: commandRecords(actor).map(record => ({ ...record, name: resolveCachedDocumentReference(record.npcUuid)?.name ?? record.npcUuid,
      active: calmActive(record, actor.flags?.cypher?.commandRecoveryRevision ?? 0, commandClock()),
      maintainable: record.state === "active" && (calmActive(record, actor.flags?.cypher?.commandRecoveryRevision ?? 0, commandClock())
        || record.mode === "maintain" && record.until?.combatId === commandClock().id && commandClock().revisions[record.until.combatantId] === record.until.revision) })),
    lighting: actor.flags?.cypher?.lightingUse };
}
