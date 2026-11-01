/** CRD Leads, Controls Beasts and Superhero Origins: explicit command lifetimes and timing. */
export const commandTiming = timing => timing === "lastAction" ? "action" : "firstAction";

/** Maintained calm lasts through the declared source turn, never across a missed turn or another combat. */
export function calmActive(record, revision, clock = {}) {
  if (record?.version !== 1 || record.state !== "active") return false;
  if (record.mode === "rest") return record.revision === revision;
  return record.mode === "maintain" && (!record.until || record.until.combatId === clock.id
    && (clock.revisions?.[record.until.combatantId] ?? 0) < record.until.revision);
}

/** Commit duration expiration and the command's renewed allowance with the actual recovery. */
export function commandRecoveryUpdates(flags = {}, interval) {
  return ["tenMinutes", "hour", "tenHours"].includes(interval)
    ? { "flags.cypher.commandRecoveryRevision": (flags.commandRecoveryRevision ?? 0) + 1 } : {};
}
