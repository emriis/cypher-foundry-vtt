/**
 * Evaluate declared weapon duration and stacking without Foundry globals. The CRD Stunstick
 * allows "a round or two"; the adopted adjudication is one round unless the GM
 * explicitly extends it to two. Source wording stays intact in persisted effects.
 */

/**
 * Read the adjudicated total duration, measured in rounds.
 * @param {object} effect Source duration and optional persisted roundCount.
 * @returns {number|null} One/two rounds, or null for another duration contract.
 */
export function weaponEffectRounds(effect) {
  if (effect.duration === "one round") return 1;
  if (effect.duration === "a round or two") return effect.roundCount === 2 ? 2 : 1;
  return null;
}

/**
 * Decide whether a round effect still belongs to the current combat interval.
 * Older flags without roundCount retain the one-round default. Outside combat,
 * NPC actions are narrative round boundaries, matching the existing contract.
 * @param {object} effect Duration plus persisted combat ID/application round.
 * @param {object|null} [combat=null] Current combat ID and round, or narrative play.
 * @returns {boolean} Whether this effect still applies; no state is changed.
 */
export function weaponEffectIsActive(effect, combat = null) {
  const rounds = weaponEffectRounds(effect);
  if (rounds === null) return true;
  if (!combat) return effect.combatId === null;
  return effect.combatId === combat.id && Number.isInteger(effect.combatRound)
    && combat.round >= effect.combatRound && combat.round < effect.combatRound + rounds;
}

/**
 * Calculate the state retained after an NPC action; the caller owns persistence.
 * @param {object} effect Persisted weapon effect and optional narrative counter.
 * @param {boolean} inCombat Whether combat rounds, rather than NPC actions, expire round effects.
 * @returns {object|null} Original effect, a decremented copy, or null when it ends.
 */
export function consumeWeaponEffectAction(effect, inCombat) {
  if (effect.duration === "next action") return null;
  const rounds = weaponEffectRounds(effect);
  if (inCombat || rounds === null || effect.combatId !== null) return effect;
  const remaining = (effect.narrativeRoundsRemaining ?? rounds) - 1;
  return remaining > 0 ? { ...effect, narrativeRoundsRemaining: remaining } : null;
}

/**
 * Match the complete structured level-three-or-higher Stunstick contract.
 * @param {object} effect Source-declared target effect, not descriptive text.
 * @returns {boolean} Whether the accepted repeated-hit policy applies.
 */
export function isStunstickHindrance(effect) {
  return effect.effect === "hindered" && effect.hinderSteps === 2
    && effect.minimumTargetLevel === 3 && effect.maximumTargetLevel === null
    && effect.duration === "a round or two";
}

/**
 * Resolve active overlapping effects without changing the input flags.
 * CRD Science Fiction Equipment supplies the Stunstick contract; repeated-hit
 * stacking is the user's adjudication: two steps with the latest expiry. Match
 * structured fields, never translated names or prose. Custom effects declaring
 * that identical contract share this policy; other effects remain independent.
 *
 * The caller first excludes expired effects and other combats. Keep the whole
 * winning interval, including its ID and GM decision; equal deadlines retain
 * the earlier entry. This also handles old worlds with multiple stored hits
 * without a schema change or writes during sheet preparation.
 * @param {object[]} effects Active effects in application order.
 * @param {object|null} combat Current combat, or narrative action boundaries.
 * @returns {object[]} Effects after resolving the accepted stacking policy.
 */
export function resolveWeaponEffectStacking(effects, combat) {
  const remaining = [];
  let stunIndex = -1;
  const expiry = effect => combat
    ? effect.combatRound + weaponEffectRounds(effect)
    : effect.narrativeRoundsRemaining ?? weaponEffectRounds(effect);
  for (const effect of effects) {
    if (!isStunstickHindrance(effect)) {
      remaining.push(effect);
    } else if (stunIndex < 0) {
      stunIndex = remaining.length;
      remaining.push(effect);
    } else if (expiry(effect) > expiry(remaining[stunIndex])) {
      remaining[stunIndex] = effect;
    }
  }
  return remaining;
}
