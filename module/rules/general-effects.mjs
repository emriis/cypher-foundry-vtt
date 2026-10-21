/** CRD Special Damage, Modifying Attack and Defense, Cooperative Actions and Guarding. */
import { reduceWoundSeverity, resolveShieldWoundSeverity } from "./wounds.mjs";
export const CONDITION_KINDS = ["dazed", "stunned", "paralyzed", "unconscious", "blinded", "prone", "hindered"];
export const COOPERATIVE_KINDS = ["help", "defenseHelp", "distraction", "draw", "take"];

/**
 * Evaluate a declared interval without mutating saved state. A source-turn
 * deadline follows the Combatant identity even when initiative is reordered.
 * Outside combat the caller must explicitly complete the narrative interval.
 */
export function generalEffectIsActive(effect, clock = {}) {
  if (!effect || typeof effect.kind !== "string") return false;
  const end = effect.until;
  if (!end) return true;
  if (end.combatId) {
    if (clock.id !== end.combatId || !Number.isInteger(clock.round)) return false;
    const index = clock.turns?.indexOf(end.combatantId) ?? -1;
    if (index < 0) return false;
    if (Number.isSafeInteger(end.turnRevision)) return (clock.turnRevisions?.[end.combatantId] ?? 0) < end.turnRevision;
    return clock.round < end.round || clock.round === end.round && (clock.turn ?? -1) < index;
  }
  return true;
}

/** Resolve rule steps and action restrictions; effects of the same condition do not multiply it. */
export function resolveGeneralModifiers(effects = [], targetEffects = [], {
  isAttack = false, isDefense = false, noPhysicalMovement = false, attackForm = null
} = {}) {
  const has = kind => effects.some(effect => effect.kind === kind);
  const targetHas = kind => targetEffects.some(effect => effect.kind === kind);
  const automaticHit = isAttack && (targetHas("paralyzed") || targetHas("unconscious"));
  return {
    rejected: has("unconscious") || has("stunned") && !isDefense
      || has("paralyzed") && !noPhysicalMovement || has("guarding") && isAttack,
    ease: (isDefense && has("guarding") ? 1 : 0) + (isAttack && targetHas("dazed") ? 1 : 0)
      + (isAttack && targetHas("blinded") ? 2 : 0)
      + (isAttack && targetHas("prone") && attackForm === "melee" ? 1 : 0)
      + (isDefense && has("prone") && attackForm === "ranged" ? 1 : 0),
    hinder: (has("dazed") ? 1 : 0)
      + effects.filter(effect => effect.kind === "hindered").reduce((total, effect) => total + (effect.steps ?? 1), 0)
      + (isDefense && has("blinded") ? 2 : 0)
      + (isAttack && targetHas("guarding") ? 1 : 0)
      + (isAttack && targetHas("prone") && attackForm === "ranged" ? 1 : 0)
      + (isDefense && has("prone") && attackForm === "melee" ? 1 : 0),
    automaticHit
  };
}

/** Help from an inability grants nothing; any positive training grants two assets. */
export function helpAssets(skillSteps = 0) {
  return skillSteps < 0 ? 0 : skillSteps > 0 ? 2 : 1;
}

/** Forecast whether even a successful Block leaves a wound the ally can intercept. */
export function blockStillHits({ defenseType, applyIncomingWound, incomingSeverity, incomingWounds,
  shieldWounds = null, survivesMajor = false }) {
  if (defenseType !== "block" || !applyIncomingWound || !reduceWoundSeverity(incomingSeverity)) return false;
  if (!shieldWounds) return true;
  const track = Object.fromEntries(Object.entries(shieldWounds).map(([severity, data]) => [severity, { ...data }]));
  for (let index = 0; index < incomingWounds; index++) {
    if (!survivesMajor && track.major.current > 0) return true;
    const severity = resolveShieldWoundSeverity(incomingSeverity, track);
    track[severity].current++;
  }
  return false;
}
