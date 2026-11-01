/** Project a retained Lighting command onto the managed round without modifying rolled initiative. */
import { getRoundFlow } from "./round-action-service.mjs";
import { runActorActions } from "./action-guard.mjs";

/** An explicit Last plan becomes normal; an ordinary next action gains First eligibility. */
export function commandRoundPlans(combat, plans) {
  const result = plans.map(plan => ({ ...plan }));
  for (const member of combat.combatants.values()) {
    const position = result.findIndex(plan => plan.combatantId === member.id), plan = result[position];
    if (member.actor?.flags?.cypher?.commandBoost?.state !== "active" || ["wait", "prepare"].includes(plan?.mode)) continue;
    const next = { ...plan, combatantId: member.id, mode: plan?.mode === "last" ? "normal" : "first", confirmed: true };
    if (position < 0) result.push(next); else result[position] = next;
  }
  return result;
}

/** First slots created by this source allow an ordinary action; Last still needs an ordinary declared slot. */
export function markCommandSlots(combat, flow) {
  for (const step of flow.queue) {
    const boost = combat.combatants.get(step.combatantId)?.actor?.flags?.cypher?.commandBoost;
    if (boost?.state === "active" && step.phase === "first") { step.readied = true; step.commandBoost = boost.id; }
  }
  return flow;
}

/** A not-yet-entered recipient can act after the commanding slot; elapsed turns never replay. */
export async function promotePendingCommand(target, context = null) {
  const combat = game.combat, flow = getRoundFlow(combat), boost = target.flags?.cypher?.commandBoost;
  if (!combat?.started || !flow || flow.rewindAnchor || boost?.state !== "active") return true;
  const member = Array.from(combat.combatants.values()).find(member => member.actor === target);
  const position = member && flow.queue.findIndex((step, index) => index > flow.cursor && step.combatantId === member.id
    && !step.done && !step.used && step.phase !== "followUp" && step.phase !== "prepare");
  if (!member || position < 0 || flow.entered.includes(member.id) || flow.queue.some(step => step.commandBoost === boost.id)) return true;
  return Boolean(await runActorActions([combat], "commandRound", async () => {
    if (getRoundFlow(combat)?.revision !== flow.revision || combat.isOwner === false) return false;
    const next = structuredClone(flow), [step] = next.queue.splice(position, 1);
    const wasLast = step.phase === "last";
    step.phase = wasLast ? "normal" : "first"; step.commandBoost = boost.id; step.readied = !wasLast;
    next.queue.splice(next.cursor + 1, 0, step);
    if (!wasLast && !next.queue.some(entry => entry.combatantId === member.id && entry.phase === "followUp")) {
      const last = next.queue.findIndex((entry, index) => index > next.cursor + 1 && entry.phase === "last");
      next.queue.splice(last < 0 ? next.queue.length : last, 0, { id: `${next.round}:${member.id}:commandFollowUp`, combatantId: member.id, phase: "followUp", used: false, activityUsed: false, done: false });
    }
    next.revision++;
    await combat.update({ "flags.cypher.roundFlow": next }); return true;
  }, context));
}
