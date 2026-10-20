/** Persist attribution boundaries alongside NPC healing, including synthetic Actors. */

/** Read the persisted healing boundary; existing Actors start at zero without migration. */
export function attackHealthRevision(actor) {
  return actor?.flags?.cypher?.attackHealthRevision ?? 0;
}

/**
 * preUpdateActor: healing invalidates old damage attribution. Known attack
 * corrections preserve other attacks' contributions. Mutate only the hook delta;
 * absent flags start at zero, with no Actor schema or migration requirement.
 * @param {Actor} actor Updated NPC.
 * @param {object} changes Dotted or expanded update delta.
 * @param {object} [options={}] Operation context.
 */
export function stampAttackHealthRevision(actor, changes, options = {}) {
  if (actor.type !== "npc" || options.cypherAttackCorrection === true) return;
  const value = Object.hasOwn(changes, "system.health.value") ? changes["system.health.value"] : changes.system?.health?.value;
  if (value === undefined || value === null || value === "" || !Number.isFinite(Number(value))
    || Number(value) <= actor.system.health?.value) return;
  changes.flags ??= {};
  changes.flags.cypher ??= {};
  changes.flags.cypher.attackHealthRevision = attackHealthRevision(actor) + 1;
}
