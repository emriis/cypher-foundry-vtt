/** Validate and persist action usage on the actual owner without requiring a player to write Combat. */
import { roundActionKind } from "../rules/round-flow.mjs";
import { runActorActions } from "./action-guard.mjs";
export const ROUND_ACTION_OWNER = Symbol("cypherRoundActionOwner");

/** Read the saved execution slot without mutating documents during presentation. */
export function getRoundFlow(combat) {
  const state = combat?.flags?.cypher?.roundFlow;
  return state?.version === 1 ? state : null;
}

/** Find the actual current combatant for an action; null means an unmanaged/outside-combat action. */
export function roundActionContext(actor, options = {}) {
  const combat = globalThis.game?.combat, flow = getRoundFlow(combat);
  if (!flow || !combat.started || options.defenseType || options.initiative || options.shieldReturn) return null;
  const members = Array.from(combat.combatants.values()).filter(entry => entry.actor === actor);
  if (!members.length) return null;
  const step = flow.queue[flow.cursor], combatant = members.find(entry => entry.id === step?.combatantId);
  const extra = options.extraAction === true;
  const source = actor.items?.get?.(options.abilitySource?.itemId);
  const extraAllowed = !extra || source?.type === "ability" && ["arc-spray", "bouncing-shield", "hidden-shield"].includes(source.system.key)
    || game.user?.isGM && typeof options.extraActionSource === "string" && options.extraActionSource.trim();
  const timing = options.weaponSource?.actionTiming ?? source?.system.action ?? options.actionTiming ?? null;
  const usage = actor.flags?.cypher?.roundActionUsage;
  const used = usage?.combatId === combat.id && usage?.stepId === step?.id ? usage : {};
  const effective = step ? { ...flow, queue: flow.queue.map(entry => entry === step
    ? { ...entry, used: entry.used || used.primary, activityUsed: entry.activityUsed || used.activity } : entry) } : flow;
  const kind = !flow.rewindAnchor && flow.round === combat.round && combatant && extraAllowed ? roundActionKind(effective, combatant.id, {
    isAttack: options.isAttack, actionTiming: timing, minorActivity: options.minorActivity, extraAction: extra
  }) : null;
  return { actor, combat, flow, step, kind, used };
}

/**
 * Commit usage before costs/dice; failures leave an auditable used slot.
 * An optional companion receipt is stored in that same Actor write, allowing
 * a paid transformation to acknowledge a lost response without acting twice.
 */
export async function consumeRoundAction(context, actionContext = null, { receiptId = null } = {}) {
  if (!context) return true;
  const { actor, combat, flow, step, kind, used } = context;
  return Boolean(await runActorActions([actor, combat], "roundUsage", async () => {
    if (receiptId && actor.flags?.cypher?.companionActions?.[receiptId]) return true;
    if (!kind || actor.isOwner === false || getRoundFlow(combat)?.revision !== flow.revision) return false;
    const latest = actor.flags?.cypher?.roundActionUsage;
    const current = latest?.combatId === combat.id && latest.stepId === step.id ? latest : {};
    if (Boolean(current.primary) !== Boolean(used.primary) || Boolean(current.activity) !== Boolean(used.activity)) return false;
    // Players own their Actor, not the GM's Combat. Usage belongs to that actual
    // Actor (including synthetic Actors), so an ordinary player needs no GM write.
    await actor.update({ "flags.cypher.roundActionUsage": { combatId: combat.id, stepId: step.id,
      primary: Boolean(used.primary || kind === "primary"), activity: Boolean(used.activity || kind === "activity") },
    ...(receiptId ? { [`flags.cypher.companionActions.${receiptId}`]: true } : {}) });
    return true;
  }, actionContext));
}
