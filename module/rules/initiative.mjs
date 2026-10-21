/** CRD / Actions and Initiative 7641–7651: higher scores act earlier. */

/** Resolve an unclamped initiative score: one eased step is three roll points. */
export function resolveInitiativeScore(d20, steps = 0) {
  return Number.isInteger(d20) && d20 >= 1 && d20 <= 20 && Number.isSafeInteger(steps)
    ? d20 + 3 * steps : null;
}

/** NPC initiative is the target number for its level, without a random roll. */
export function resolveNpcInitiative(level) {
  return Number.isSafeInteger(level) && level >= 0 ? level * 3 : null;
}

/**
 * Descending scores, with a PC before an equal NPC as explicitly required by
 * the CRD. Unrolled combatants remain last; stable IDs break all remaining ties.
 * @param {object} a Combatant-shaped score, Actor type and ID.
 * @param {object} b Other combatant.
 * @returns {number} Standard comparator result.
 */
export function compareInitiative(a, b) {
  const score = entry => Number.isFinite(entry.initiative) ? entry.initiative : -Infinity;
  const delta = score(b) - score(a);
  if (delta) return delta;
  if (Number.isFinite(a.initiative) && Number.isFinite(b.initiative)) {
    if (a.actor?.type === "pc" && b.actor?.type === "npc") return -1;
    if (a.actor?.type === "npc" && b.actor?.type === "pc") return 1;
  }
  return a.id === b.id ? 0 : String(a.id) < String(b.id) ? -1 : 1;
}
