import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
/** Persist explicit general-rule effects on the actual Actor, including synthetic Actors. */
import { CONDITION_KINDS, generalEffectIsActive, resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { runActorAction } from "./action-guard.mjs";

/** Expose supported condition choices to sheets without a sheet-to-rules dependency. */
export function getGeneralConditionKinds() { return [...CONDITION_KINDS]; }

/** Snapshot only the combat data required by pure interval calculations. */
export function generalEffectClock() {
  const combat = globalThis.game?.combat;
  return { id: combat?.id ?? null, round: combat?.round ?? null, turn: combat?.turn ?? null,
    turnRevisions: combat?.flags?.cypher?.turnRevisions ?? {},
    turns: combat?.turns?.map(entry => entry.id) ?? [] };
}

/** Read active flags without writing during sheet or task preparation. */
export function getGeneralEffects(actor, clock = generalEffectClock()) {
  return (actor?.flags?.cypher?.generalEffects ?? []).filter(effect => generalEffectIsActive(effect, clock)
    && (effect.actionRevision == null || effect.actionRevision === (actor.flags?.cypher?.weaponActionRevision ?? 0)));
}

/** Capture the start of this source's next turn; null means explicit narrative completion. */
export function nextSourceTurn(actor) {
  const combat = globalThis.game?.combat;
  const index = combat?.turns?.findIndex(entry => entry.actor === actor || entry.actor?.uuid === actor.uuid) ?? -1;
  if (index < 0 || !(combat.round > 0)) return null;
  return { combatId: combat.id, combatantId: combat.turns[index].id,
    turnRevision: (combat.flags?.cypher?.turnRevisions?.[combat.turns[index].id] ?? 0) + 1,
    round: combat.round + (index <= combat.turn ? 1 : 0) };
}

/**
 * preUpdateCombat: count actual forward turn entries in the same Combat write.
 * Initiative reordering and rewinds do not consume a source's next turn. This
 * survives reload and avoids expiring help merely because its source moved
 * ahead of the active combatant after an initiative reroll.
 */
export function stampGeneralTurnRevision(combat, changes, options = {}) {
  if (options.cypherRoundFlow) {
    const ids = [...new Set(options.cypherPrimaryTurns ?? [])];
    if (!ids.length || (options.direction ?? 1) < 0) return;
    changes.flags ??= {}; changes.flags.cypher ??= {}; changes.flags.cypher.turnRevisions ??= {};
    for (const id of ids) changes.flags.cypher.turnRevisions[id] = (combat.flags?.cypher?.turnRevisions?.[id] ?? 0) + 1;
    return;
  }
  if (options.cypherInitiativeReorder || (options.direction ?? 1) < 0
    || !["turn", "round"].some(key => Object.hasOwn(changes, key))) return;
  const round = changes.round ?? combat.round, turn = changes.turn ?? combat.turn;
  if (!(round > 0) || !Number.isInteger(turn) || turn < 0
    || round < combat.round || round === combat.round && turn <= (combat.turn ?? -1)) return;
  const id = combat.turns?.[turn]?.id;
  if (!id) return;
  changes.flags ??= {};
  changes.flags.cypher ??= {};
  changes.flags.cypher.turnRevisions ??= {};
  changes.flags.cypher.turnRevisions[id] = (combat.flags?.cypher?.turnRevisions?.[id] ?? 0) + 1;
}

/**
 * Apply an explicitly adjudicated condition, never infer one from NPC prose.
 * Duration is either manual or until the affected character's next turn.
 * The latter requires an active encounter; outside it the UI uses manual expiry.
 */
export async function setGeneralCondition(actor, kind, { nextTurn = false, steps = 1 } = {}) {
  if (!["pc", "npc"].includes(actor?.type) || actor.isOwner === false || !CONDITION_KINDS.includes(kind)
    || !Number.isSafeInteger(steps) || steps < 1) return false;
  return Boolean(await runActorAction(actor, "generalCondition", async () => {
    const until = nextTurn ? nextSourceTurn(actor) : null;
    if (nextTurn && !until) return false;
    await actor.update({ "flags.cypher.generalEffects": [...getGeneralEffects(actor).filter(effect => effect.kind !== kind),
      { id: foundry.utils.randomID(), kind, steps, until }] });
    return true;
  }));
}

/** Remove one declared effect; overlapping effects with other identities survive. */
export async function removeGeneralEffect(actor, id) {
  if (actor?.isOwner === false) return false;
  return Boolean(await runActorAction(actor, "generalEffectRemoval", async () => {
    const effects = actor?.flags?.cypher?.generalEffects ?? [];
    if (!effects.some(effect => effect.id === id)) return false;
    await actor.update({ "flags.cypher.generalEffects": effects.filter(effect => effect.id !== id) });
    return true;
  }));
}

/** Guarding persists until explicitly ended and forbids attacks through the shared task engine. */
export async function setGuarding(actor, active = true) {
  if (!["pc", "npc"].includes(actor?.type) || actor.isOwner === false) return false;
  return Boolean(await runActorAction(actor, "guarding", async context => {
    if (active && resolveGeneralModifiers(getGeneralEffects(actor)).rejected) return false;
    const effects = getGeneralEffects(actor).filter(effect => effect.kind !== "guarding");
    if (active && !await consumeRoundAction(roundActionContext(actor), context)) return false;
    if (active) effects.push({ id: foundry.utils.randomID(), kind: "guarding" });
    await actor.update({ "flags.cypher.generalEffects": effects });
    return true;
  }));
}
