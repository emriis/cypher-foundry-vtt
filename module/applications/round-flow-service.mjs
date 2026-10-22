/** Persist the CRD round queue on Combat; rolled scores and base Combatant order stay intact. */
import { createRoundFlow, completeRoundStep, holdRoundTurn, resumeRoundTurn } from "../rules/round-flow.mjs";
import { runActorActions } from "./action-guard.mjs";
import { getGeneralEffects, generalEffectClock } from "./general-effect-service.mjs";
import { getRoundFlow } from "./round-action-service.mjs";
export { getRoundFlow } from "./round-action-service.mjs";

const owns = combat => combat && combat.isOwner !== false && game.user?.isGM === true;
const idsOf = combat => (combat.turns ?? []).map(entry => entry.id);

/** Save explicit GM timing declarations for the first or next round; cancellation happens in the UI. */
export async function planCombatRound(combat, plans, { round = combat.round > 0 ? combat.round + 1 : 1 } = {}) {
  if (!owns(combat) || !Array.isArray(plans) || round !== (combat.round > 0 ? combat.round + 1 : 1)) return false;
  return Boolean(await runActorActions([combat], "roundPlan", async () => {
    const state = getRoundFlow(combat);
    const candidate = createRoundFlow(idsOf(combat), plans, round, state?.prepared ?? []);
    if (!candidate) return false;
    if (combat.round > 0) {
      if (!state || state.round !== combat.round || state.rewindAnchor) return false;
      await combat.update({ "flags.cypher.roundFlow": { ...state, nextPlans: plans, revision: state.revision + 1 } });
    } else await combat.update({ "flags.cypher.roundFlow": candidate });
    return true;
  }));
}

/** Start a fresh scheduled round, including default ordinary turns when no declaration was made. */
export async function beginCombatRound(combat, round = 1) {
  if (!owns(combat) || !Number.isSafeInteger(round) || round < 1 || round < combat.round) return combat;
  return (await runActorActions([combat, ...Array.from(combat.combatants.values()).map(entry => entry.actor)], "roundAdvance", async () => {
    const previous = getRoundFlow(combat);
    if (previous?.rewindAnchor) {
      await persistPosition(combat, { ...previous.rewindAnchor, rewindAnchor: null, revision: previous.revision }, { rewind: true });
      return combat;
    }
    if (previous?.round === round && combat.round > 0) return combat;
    await settleShieldLosses(combat, previous);
    const ids = idsOf(combat);
    const plans = (previous?.round === round ? previous.plans : previous?.nextPlans ?? [])
      .filter(entry => ids.includes(entry.combatantId));
    const flow = createRoundFlow(ids, plans, round, previous?.prepared ?? []);
    if (!flow) return combat;
    if (previous && previous.round < round) flow.history = [...(previous.history ?? []), { ...previous, history: [] }];
    flow.cursor = 0;
    await enterRoundStep(combat, flow);
    return combat;
  })) ?? combat;
}

/** Advance a saved queue once; the end builds a fresh round from original initiative order. */
export async function advanceCombatRound(combat) {
  if (!owns(combat)) return combat;
  if (!combat.round) return beginCombatRound(combat);
  const original = getRoundFlow(combat);
  if (!original || original.round !== combat.round) return beginCombatRound(combat, combat.round);
  return (await runActorActions([combat, ...Array.from(combat.combatants.values()).map(entry => entry.actor)], "roundAdvance", async () => {
    const current = getRoundFlow(combat);
    if (current.rewindAnchor) {
      await persistPosition(combat, { ...current.rewindAnchor, rewindAnchor: null, revision: current.revision }, { rewind: true });
      return combat;
    }
    await settleShieldLosses(combat, getRoundFlow(combat));
    let flow = completeRoundStep(getRoundFlow(combat));
    if (flow.cursor >= flow.queue.length) {
      const ids = idsOf(combat);
      const next = createRoundFlow(ids, flow.nextPlans.filter(entry => ids.includes(entry.combatantId)), flow.round + 1, flow.prepared);
      if (!next) return combat;
      next.history = [...(flow.history ?? []), { ...flow, history: [] }];
      next.cursor = 0;
      flow = next;
    }
    await enterRoundStep(combat, flow);
    return combat;
  })) ?? combat;
}

/** Rewind presentation only: action usage, costs, injuries and turn revisions are never restored. */
export async function rewindCombatRound(combat, { previousRound = false } = {}) {
  if (!owns(combat)) return combat;
  return (await runActorActions([combat], "roundRewind", async () => {
    let flow = getRoundFlow(combat);
    if (!flow) return combat;
    const anchor = flow.rewindAnchor ?? structuredClone(flow);
    if (previousRound || flow.cursor <= 0) {
      const history = [...(flow.history ?? [])], previous = history.pop();
      if (!previous) return combat;
      flow = { ...previous, history };
      flow.cursor = Math.max(0, flow.queue.length - 1);
    } else flow = { ...flow, cursor: flow.cursor - 1 };
    await persistPosition(combat, { ...flow, rewindAnchor: anchor }, { rewind: true });
    return combat;
  })) ?? combat;
}

/** Hold only an unspent ordinary turn; a named trigger is confirmed explicitly on resumption. */
export async function waitCombatTurn(combat, { trigger = "" } = {}) {
  if (!owns(combat) || typeof trigger !== "string") return false;
  return Boolean(await runActorActions([combat, ...Array.from(combat.combatants.values()).map(entry => entry.actor)], "roundWait", async () => {
    const state = getRoundFlow(combat);
    if (!state || state.round !== combat.round || state.rewindAnchor) return false;
    const step = state.queue[state.cursor], actor = combat.combatants.get(step?.combatantId)?.actor;
    const usage = actor?.flags?.cypher?.roundActionUsage;
    if (usage?.combatId === combat.id && usage.stepId === step?.id && (usage.primary || usage.activity)) return false;
    const held = holdRoundTurn(state, trigger.trim());
    if (!held) return false;
    const next = { ...held, cursor: held.cursor + 1 };
    await enterRoundStep(combat, next);
    return true;
  }));
}

/** Resume just before the current declared event; never infer a trigger from movement or prose. */
export async function resumeCombatTurn(combat, combatantId, { triggerConfirmed = false } = {}) {
  if (!owns(combat)) return false;
  return Boolean(await runActorActions([combat, ...Array.from(combat.combatants.values()).map(entry => entry.actor)], "roundResume", async () => {
    const state = getRoundFlow(combat);
    if (!state || state.round !== combat.round || state.rewindAnchor || !combat.combatants.get(combatantId)) return false;
    const next = resumeRoundTurn(state, combatantId, triggerConfirmed);
    if (!next) return false;
    await enterRoundStep(combat, next);
    return true;
  }));
}

/** Skip unavailable slots, then persist one actual primary-turn boundary, never a follow-up boundary. */
async function enterRoundStep(combat, state) {
  const flow = structuredClone(state);
  const shieldLosses = [];
  const enteredIds = [], revisions = { ...combat.flags?.cypher?.turnRevisions };
  while (flow.cursor < flow.queue.length) {
    const step = flow.queue[flow.cursor], combatant = combat.combatants.get(step.combatantId), actor = combatant?.actor;
    const primary = step.phase !== "followUp" && !flow.entered.includes(step.combatantId);
    if (primary && combatant) {
      flow.entered.push(step.combatantId); enteredIds.push(step.combatantId);
      revisions[step.combatantId] = (revisions[step.combatantId] ?? 0) + 1;
    }
    const clock = { ...generalEffectClock(), id: combat.id, round: flow.round,
      turns: idsOf(combat), turnRevisions: revisions };
    const incapacitated = getGeneralEffects(actor, clock).some(effect => ["stunned", "unconscious"].includes(effect.kind));
    const shieldLoss = primary
      && actor?.flags?.cypher?.shieldTurnLossPending;
    if (combatant && !step.skipped && !(combat.settings?.skipDefeated && combatant.isDefeated) && !incapacitated && !shieldLoss) break;
    step.done = true; step.skipped = true;
    if (shieldLoss) {
      shieldLosses.push(actor);
      flow.shieldLosses ??= [];
      flow.shieldLosses.push({ combatantId: combatant.id,
        revision: actor.flags?.cypher?.shieldTurnLossRevision ?? 0 });
    }
    if (incapacitated || shieldLoss) {
      for (const later of flow.queue.slice(flow.cursor + 1)) if (later.combatantId === step.combatantId) later.skipped = true;
    }
    flow.cursor++;
  }
  await persistPosition(combat, flow, { enteredIds });
  // Save the skipped slot before clearing its Actor flag. On a partial failure
  // the saved queue explains the consumed turn; no historical state is restored.
  for (const actor of shieldLosses) await actor.update({ "flags.cypher.shieldTurnLossPending": false,
    "flags.cypher.shieldTurnLossConsumedRevision": actor.flags?.cypher?.shieldTurnLossRevision ?? 0 });
}

/** Retry only recorded flag-clearing writes after a partial turn-skip failure. */
async function settleShieldLosses(combat, flow) {
  for (const entry of flow?.shieldLosses ?? []) {
    const actor = combat.combatants.get(entry.combatantId)?.actor, flags = actor?.flags?.cypher;
    if (flags?.shieldTurnLossPending && (flags.shieldTurnLossRevision ?? 0) === entry.revision
      && flags.shieldTurnLossConsumedRevision !== entry.revision) await actor.update({
      "flags.cypher.shieldTurnLossPending": false, "flags.cypher.shieldTurnLossConsumedRevision": entry.revision
    });
  }
}

async function persistPosition(combat, state, { rewind = false, enteredIds = [] } = {}) {
  const flow = structuredClone(state), step = flow.queue[flow.cursor];
  flow.revision++;
  const turn = step ? combat.turns.findIndex(entry => entry.id === step.combatantId) : null;
  const delta = !rewind && combat.round > 0 && flow.round > combat.round
    ? combat.getTimeDelta?.(combat.round, combat.turn, flow.round, combat.turn) ?? 0 : 0;
  await combat.update({ round: flow.round, turn, "flags.cypher.roundFlow": flow }, {
    turnEvents: false, cypherRoundFlow: true, cypherPrimaryTurns: enteredIds,
    ...(delta > 0 ? { worldTime: { delta } } : {}),
    direction: rewind ? -1 : 1
  });
}

