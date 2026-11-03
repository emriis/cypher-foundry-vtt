/** Level-six nonphysical barriers, prepaid creation and individually attributed NPC containment attacks. */
import { FORCE_FIELD_SHAPES, barrierEffort } from "../rules/awesome-force-field.mjs";
import { validateAwesomeCapture, applyAwesomeCapture } from "./awesome-capture-effect.mjs";
import { resolveTaskEffort } from "../rules/task-effort.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { computeEffortCost } from "../rules/tasks.mjs";
import { awesomeBarriers, awesomeBarrierObstructs, awesomeEpoch } from "./awesome-field-read.mjs";
import { resolveDocumentReference, resolveCachedDocumentReference } from "./reference-resolver.mjs";
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { getSuperheroicsRank } from "./task-preparation.mjs";
import { rollTask } from "./task-service.mjs";
const allowed = actor => actor?.type === "pc" && actor.isOwner !== false && game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const items = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);

/**
 * GM declarations establish placement and which NPCs initially occupy a cube/sphere.
 * Targets are actual NPC UUIDs, including synthetic Actors. Effort is in levels;
 * the returned barrier ID identifies resumable state, or null means rejection.
 * Payment precedes Object creation: a later write failure leaves a pending entry.
 */
export async function createAwesomeBarrier(actor, itemId, { confirmed = false, inRange = false, shape = "wall", location = "", targets = [] } = {}) {
  if (!allowed(actor) || confirmed !== true || inRange !== true || !FORCE_FIELD_SHAPES.includes(shape) || typeof location !== "string" || !location.trim()
    || !Array.isArray(targets) || new Set(targets).size !== targets.length || targets.length && !["cube", "sphere"].includes(shape)) return null;
  return runActorActions([actor], "awesomeBarrier", async context => {
    const item = actor.items.get(itemId);
    if (item?.type !== "ability" || item.system.key !== "awesome-force-field" || item.isOwner === false
      || awesomeBarriers(actor).some(field => field.state === "pending") || resolveGeneralModifiers(getGeneralEffects(actor)).rejected
      || ["dead", "unconscious", "stunned", "paralyzed"].some(status => actor.statuses?.has(status))) return null;
    const npcs = [];
    for (const uuid of targets) {
      const npc = await resolveDocumentReference(uuid, "npc");
      if (!npc || npc.isOwner === false || !(npc.system.health?.value > 0)) return null;
      npcs.push(npc);
    }
    const live = awesomeBarriers(actor).filter(field => {
      const object = resolveCachedDocumentReference(field.objectUuid);
      return object && awesomeBarrierObstructs(object);
    }).length;
    const levels = barrierEffort(live), modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, items(actor), actor.system);
    const edge = actor.system.stats.intellect.edge + (modifiers.edge.intellect ?? 0);
    const effort = resolveTaskEffort({ effectEffortLevels: levels, isAttack: true, edge,
      effortScore: actor.system.effort, superheroicsRank: getSuperheroicsRank(actor, "intellect") });
    if (!effort || actor.system.stats.intellect.pool.value < effort.cost) return null;
    return runActorActions([actor, ...npcs], "awesomeBarrierCommit", async () => {
      const round = roundActionContext(actor, { actionTiming: "action" });
      if (round && !round.kind || !await consumeRoundAction(round, context)) return null;
      const id = foundry.utils.randomID(), field = { version: 1, id, itemId, name: item.name, state: "pending", shape,
        location: location.trim(), epoch: awesomeEpoch(actor), levels, cost: effort.cost, edgeUsed: Math.min(edge, computeEffortCost(levels)), refunded: false,
        actionStamp: round?.step ? { combatId: round.combat.id, stepId: round.step.id } : null,
        targets: npcs.map(npc => ({ id: foundry.utils.randomID(), uuid: npc.uuid, state: "awaiting" })), objectUuid: null };
      await actor.update({ "system.stats.intellect.pool.value": actor.system.stats.intellect.pool.value - effort.cost, [`flags.cypher.awesomeBarriers.${id}`]: field });
      return await materializeBarrier(actor, field) ? id : null;
    }, context);
  });
}

/** A unique source tag finds a creation whose acknowledgement was lost; no duplicate Object is created. */
async function materializeBarrier(actor, field) {
  let object = field.objectUuid && await resolveDocumentReference(field.objectUuid, "object");
  object ??= (game.actors?.contents ?? []).find(candidate => candidate.flags?.cypher?.awesomeBarrier?.id === field.id
    && candidate.flags.cypher.awesomeBarrier.ownerUuid === actor.uuid);
  if (!object) object = await foundry.documents.Actor.implementation.create({ name: `${field.name}: ${field.location}`, type: "object", ownership: structuredClone(actor.ownership ?? {}),
    system: { originalLevel: 6, levelDamage: 0, destructionDamage: 0, physical: false, material: "", description: "" },
    flags: { cypher: { awesomeBarrier: { version: 1, id: field.id, ownerUuid: actor.uuid, shape: field.shape, location: field.location } } } });
  if (!object || object.isOwner === false || object.system.originalLevel !== 6 || object.system.physical !== false) return false;
  await actor.update({ [`flags.cypher.awesomeBarriers.${field.id}.objectUuid`]: object.uuid, [`flags.cypher.awesomeBarriers.${field.id}.state`]: "active" });
  return true;
}
/** Finish pending materialization without repaying, renewing expiry or requiring the removed source Item. */
export async function resumeAwesomeBarrier(actor, id) {
  if (!allowed(actor)) return false;
  return Boolean(await runActorActions([actor], "awesomeBarrierResume", async () => {
    const field = awesomeBarriers(actor).find(field => field.id === id && field.state === "pending");
    return field ? materializeBarrier(actor, field) : false;
  }));
}
/** End the effect while retaining its Object and expenditure for historical roll corrections. */
export async function endAwesomeBarrier(actor, id) {
  if (!allowed(actor)) return false;
  return Boolean(await runActorActions([actor], "awesomeBarrierEnd", async () => {
    if (!awesomeBarriers(actor).some(field => field.id === id)) return false;
    await actor.update({ [`flags.cypher.awesomeBarriers.${id}.state`]: "ended" }); return true;
  }));
}

/**
 * Make one paid non-damaging Intellect attack against an initially declared NPC.
 * The first target shares creation's paid levels/Edge; all later targets use a
 * separate attack allocation. Null rejects before dice or costs. A post-payment
 * exception leaves a rolling entry requiring observed-result adjudication.
 */
export async function containWithAwesomeBarrier(actor, fieldId, targetId, { confirmed = false, effortLevels = 0, assetSteps = 0, skillItemId = null } = {}) {
  if (!allowed(actor) || confirmed !== true) return null;
  return runActorActions([actor], "awesomeCaptureRequest", async context => {
    const field = actor.flags?.cypher?.awesomeBarriers?.[fieldId], entry = field?.targets?.find(entry => entry.id === targetId);
    const target = entry && await resolveDocumentReference(entry.uuid, "npc");
    const first = field?.targets?.[0]?.id === targetId;
    const effect = { kind: "awesomeCapture", id: targetId, targetId, fieldId, first, sourceUuid: actor.uuid };
    if (!validateAwesomeCapture(actor, target, effect)) return null;
    return rollTask(actor, { [ACTION_CONTEXT]: context, stat: "intellect", isAttack: true, targetActor: target, baseDamage: 0, difficulty: target.system.level,
      abilitySource: { itemId: field.itemId }, effortLevels, assetSteps, skillItemId, previousPaidLevels: first ? field.levels : 0,
      spentAbilityEdge: first ? field.edgeUsed : 0, extraAction: true, extraActionSource: "awesome-capture", followerChoices: [],
      ruleEffect: { targetUuid: target.uuid, effect } });
  });
}

/** A capture interrupted after its paid checkpoint never rerolls automatically; the GM records the observed result. */
export async function reconcileAwesomeCapture(actor, fieldId, targetId, { confirmed = false, success, note = "" } = {}) {
  if (!allowed(actor) || confirmed !== true || typeof success !== "boolean" || typeof note !== "string" || !note.trim()) return false;
  return Boolean(await runActorActions([actor], "awesomeCaptureReview", async context => {
    const field = actor.flags?.cypher?.awesomeBarriers?.[fieldId], entry = field?.targets?.find(entry => entry.id === targetId);
    if (entry?.state !== "rolling") return false;
    const target = await resolveDocumentReference(entry.uuid, "npc");
    if (!target || target.isOwner === false) return false;
    if (success) return applyAwesomeCapture(target, { sourceUuid: actor.uuid, fieldId, targetId, note }, context);
    await actor.update({ [`flags.cypher.awesomeBarriers.${fieldId}.targets`]: field.targets.map(target => target.id === targetId ? { ...target, state: "complete", success: false, note } : target) }); return true;
  }));
}

/** A GM-declared departure is not undone by repairing the barrier or rerolling its damage later. */
export async function releaseAwesomeContainment(actor, id, { confirmed = false } = {}) {
  if (!game.user?.isGM || actor?.isOwner === false || confirmed !== true || !actor.flags?.cypher?.awesomeContainments?.[id]) return false;
  return Boolean(await runActorActions([actor], "awesomeRelease", async () => {
    await actor.update({ [`flags.cypher.awesomeContainments.${id}.released`]: true }); return true;
  }));
}
