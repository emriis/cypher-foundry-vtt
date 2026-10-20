/** Track destructive edits to defense attribution without maintaining a second wound store. */
import { CYPHER } from "../config.mjs";

/** Read one revision. Old Actors need no migration; absent history starts at zero. */
export function defenseRevision(actor, key) {
  return actor.flags?.cypher?.defenseRevisions?.[key] ?? 0;
}

/** Read either a dotted service patch or an expanded Foundry hook delta. */
function changedValue(changes, path) {
  const value = Object.hasOwn(changes, path) ? changes[path]
    : path.split(".").reduce((entry, key) => entry?.[key], changes);
  return typeof value === "string" && value.trim() !== "" ? Number(value) : value;
}

/**
 * preUpdateActor hook: revision changes accompany the same persisted wound/Pool
 * edit. Healing/removal invalidates old wound attribution; Pool recovery does
 * the same for recorded Pool loss. A known defense correction keeps attribution
 * of other defenses intact. No document writes are performed by this hook.
 * @param {Actor} actor Actual PC, including an unlinked token Actor.
 * @param {object} changes Pending document delta, mutated before persistence.
 * @param {object} [options={}] Update operation options.
 * @returns {void}
 */
export function stampDefenseRevisions(actor, changes, options = {}) {
  if (actor.type !== "pc" || options.cypherDefenseCorrection === true) return;
  const invalidated = [];
  for (const severity of CYPHER.woundSeverities) {
    const next = changedValue(changes, `system.wounds.${severity}.current`);
    if (Number.isFinite(next) && next < actor.system.wounds?.[severity]?.current) invalidated.push(`wound_${severity}`);
  }
  for (const stat of CYPHER.stats) {
    const next = changedValue(changes, `system.stats.${stat}.pool.value`);
    if (Number.isFinite(next) && next > actor.system.stats?.[stat]?.pool.value) invalidated.push(`pool_${stat}`);
  }
  if (!invalidated.length) return;
  changes.flags ??= {};
  changes.flags.cypher ??= {};
  changes.flags.cypher.defenseRevisions ??= {};
  for (const key of invalidated) changes.flags.cypher.defenseRevisions[key] = defenseRevision(actor, key) + 1;
}
