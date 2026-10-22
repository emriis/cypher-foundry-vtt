/** CRD GM Intrusions / Player Intrusions / Experience Points (7399–7414, 7995, 8116). */

/** Plan net XP changes after the affected player chooses the obligatory share. */
export function intrusionXPPlan(kind, { xp = 0, distinctPlayer = false, distinctActor = false } = {}) {
  if (kind === "player") return Number.isSafeInteger(xp) && xp >= 1 ? [-1] : null;
  if (kind === "gmFree") return [];
  if (kind === "gm") return distinctPlayer && distinctActor ? [1, 1] : null;
  return null;
}

/** A reaction belongs to precisely the next primary turn, never a Follow-up or a rewind. */
export function intrusionReactionIsCurrent(deadline, clock) {
  if (!deadline || !clock || deadline.combatId !== clock.combatId || deadline.combatantId !== clock.combatantId
    || clock.rewound || clock.phase === "followUp") return false;
  return Number.isSafeInteger(deadline.turnRevision) && deadline.turnRevision === clock.turnRevision;
}
