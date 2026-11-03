/** Personal Awesome Force Field activation and atomic, attributable shattering. */
import { awesomePersonalActive, awesomeSuspended, awesomeEpoch } from "./awesome-field-read.mjs";
import { shatterCost } from "../rules/awesome-force-field.mjs";
import { nextSourceTurn } from "./general-effect-service.mjs";
import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
import { runActorActions } from "./action-guard.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
const owns = actor => actor?.type === "pc" && actor.isOwner !== false;

/** Initial zero-cost activation still consumes an action; recasting cannot bypass an uncompleted shatter interval. */
export async function activateAwesomePersonal(actor, itemId, { confirmed = false } = {}) {
  if (!owns(actor) || confirmed !== true) return false;
  return Boolean(await runActorActions([actor], "awesomePersonal", async context => {
    const item = actor.items.get(itemId), existing = actor.flags?.cypher?.awesomePersonal;
    if (item?.type !== "ability" || item.system.key !== "awesome-force-field" || item.isOwner === false
      || resolveGeneralModifiers(getGeneralEffects(actor)).rejected
      || ["dead", "unconscious", "stunned", "paralyzed"].some(status => actor.statuses?.has(status))
      || existing?.epoch === awesomeEpoch(actor) && (awesomePersonalActive(actor) || awesomeSuspended(actor))) return false;
    const round = roundActionContext(actor, { actionTiming: "action" });
    if (round && !round.kind || !await consumeRoundAction(round, context)) return false;
    await actor.update({ "flags.cypher.awesomePersonal": { version: 1, id: foundry.utils.randomID(), itemId, name: item.name,
      state: "active", epoch: awesomeEpoch(actor), shatteredUntil: null } }); return true;
  }));
}

/** Capture the original field identity and remaining Edge; paid rerolls never substitute another later activation. */
export function awesomeBlockSnapshot(actor, remainingEdge) {
  return awesomePersonalActive(actor) ? { version: 1, fieldId: actor.flags.cypher.awesomePersonal.id,
    id: foundry.utils.randomID(), remainingEdge, shattered: false, cost: 0 } : null;
}

/** One wound per defense roll. Accepted cancellation writes Pool cost and the next-turn deadline together. */
export async function maybeShatterAwesome(actor, snapshot, { success, residual, natural20 = false, choose = null, context = null } = {}) {
  if (!snapshot || snapshot.shattered || !success || !residual || !choose || !owns(actor)) return snapshot;
  const receipt = actor.flags?.cypher?.awesomeShatters?.[snapshot.id];
  if (receipt) return { ...snapshot, shattered: true, cost: receipt.cost };
  if (!awesomePersonalActive(actor) || actor.flags.cypher.awesomePersonal.id !== snapshot.fieldId) return snapshot;
  const cost = shatterCost(snapshot.remainingEdge, natural20);
  if (actor.system.stats.intellect.pool.value < cost || await choose({ cost }) !== true) return snapshot;
  return await runActorActions([actor], "awesomeShatter", async () => {
    if (!awesomePersonalActive(actor) || actor.flags.cypher.awesomePersonal.id !== snapshot.fieldId
      || actor.system.stats.intellect.pool.value < cost) return snapshot;
    const until = nextSourceTurn(actor) ?? { narrative: true };
    await actor.update({ "system.stats.intellect.pool.value": actor.system.stats.intellect.pool.value - cost,
      "flags.cypher.awesomePersonal.shatteredUntil": until, [`flags.cypher.awesomeShatters.${snapshot.id}`]: { fieldId: snapshot.fieldId, cost } });
    return { ...snapshot, shattered: true, cost };
  }, context) ?? snapshot;
}

/** Outside the original Combat, the GM confirms the next narrative turn rather than clearing the deadline on reload. */
export async function restoreAwesomePersonal(actor, { confirmed = false } = {}) {
  if (!owns(actor) || !game.user?.isGM || confirmed !== true) return false;
  return Boolean(await runActorActions([actor], "awesomeRestore", async () => {
    const field = actor.flags?.cypher?.awesomePersonal, until = field?.shatteredUntil;
    if (!until || field.epoch !== awesomeEpoch(actor)) return false;
    if (until.combatId && game.combat?.id === until.combatId && awesomeSuspended(actor)) return false;
    await actor.update({ "flags.cypher.awesomePersonal.shatteredUntil": null }); return true;
  }));
}
