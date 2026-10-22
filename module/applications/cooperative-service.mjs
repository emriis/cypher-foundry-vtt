import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
/** Explicit cooperation declarations; task rolls consume only their selected mode. */
import { helpAssets, resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { getGeneralEffects, nextSourceTurn } from "./general-effect-service.mjs";
import { runActorActions } from "./action-guard.mjs";

/**
 * Declare a source-backed action without inventing adjacency or a skill match.
 * Helpers explicitly choose their applicable owned skill; the beneficiary
 * chooses whether to use help on a subsequent task. No-roll declarations are
 * actions; being stunned/paralyzed/unconscious prevents them as appropriate.
 */
export async function declareCooperation(actor, target, { kind, skillItemId = null, taskLabel = "" } = {}) {
  if (actor?.type !== "pc" || actor.isOwner === false || target?.isOwner === false || actor === target
    || !actor.uuid || !target?.uuid || !["help", "defenseHelp", "distraction", "draw"].includes(kind)
    || (["distraction", "draw"].includes(kind) ? target.type !== "npc" : target.type !== "pc")) return false;
  return Boolean(await runActorActions([actor, target], "cooperation", async context => {
    if (resolveGeneralModifiers(getGeneralEffects(actor)).rejected) return false;
    const skill = skillItemId ? actor.items?.get(skillItemId) : null;
    if (skillItemId && (skill?.type !== "skill" || skill.isOwner === false)) return false;
    const assets = helpAssets(skill?.system.stepModifier ?? 0);
    if (kind === "help" && (!assets || !taskLabel.trim())) return false;
    // Repeating a declaration from the same helper refreshes it, never mints
    // extra assets. Different helpers can help, subject to the task's asset cap.
    let effects = getGeneralEffects(target).filter(effect => !(effect.kind === kind && effect.sourceUuid === actor.uuid));
    if (kind === "draw") {
      // Two characters drawing the same attack cancel each other. Persist a
      // conflict marker until that NPC action so a third declaration cannot
      // silently reactivate a previously cancelled draw.
      const cancelled = effects.some(effect => effect.kind === "draw");
      effects = effects.filter(effect => effect.kind !== "draw");
      effects.push({ id: foundry.utils.randomID(), kind, sourceUuid: actor.uuid, cancelled,
        actionRevision: target.flags?.cypher?.weaponActionRevision ?? 0 });
    } else {
      effects.push({ id: foundry.utils.randomID(), kind, sourceUuid: actor.uuid, assets: kind === "defenseHelp" ? 1 : assets,
        taskLabel: taskLabel.trim(), until: kind === "help" ? null : nextSourceTurn(actor) });
    }
    if (!await consumeRoundAction(roundActionContext(actor), context)) return false;
    await target.update({ "flags.cypher.generalEffects": effects });
    return true;
  }));
}

/** Resolve help only after a caller explicitly selects that cooperative mode. */
export function cooperativeTaskPlan(actor, mode, isDefense, npc = null, effectIds = null) {
  if (mode == null || mode === "none") return { assets: 0, consumed: [], ease: 0, hinder: 0 };
  if (["distraction", "draw", "take"].includes(mode)) {
    if (!isDefense || npc?.type !== "npc" || npc.isOwner === false) return null;
    const effects = getGeneralEffects(npc);
    if (mode === "take") return { assets: 0, consumed: [], ease: 0, hinder: 0 };
    if (mode === "distraction" && effects.some(effect => effect.kind === "distraction")) {
      return { assets: 0, consumed: [], ease: 1, hinder: 0 };
    }
    const draw = effects.find(effect => effect.kind === "draw" && !effect.cancelled && effect.sourceUuid === actor.uuid);
    return mode === "draw" && draw ? { assets: 0, consumed: [], ease: 0, hinder: draw.hinder ?? 0 } : null;
  }
  if (mode !== "help") return null;
  if (effectIds !== null && (!Array.isArray(effectIds) || effectIds.some(id => typeof id !== "string"))) return null;
  const effects = getGeneralEffects(actor).filter(effect => (effect.kind === "help" || isDefense && effect.kind === "defenseHelp")
    && (effectIds === null || effectIds.includes(effect.id)));
  if (effectIds?.some(id => !effects.some(effect => effect.id === id))) return null;
  if (!effects.length) return null;
  return { assets: Math.min(2, effects.reduce((total, effect) => total + effect.assets, 0)),
    consumed: effects.filter(effect => effect.kind === "help").map(effect => effect.id), ease: 0, hinder: 0 };
}

/** Consume accepted one-task help together with other Actor costs, before dice. */
export function consumeCooperationUpdate(actor, ids) {
  return ids.length ? { "flags.cypher.generalEffects": getGeneralEffects(actor).filter(effect => !ids.includes(effect.id)) } : {};
}
