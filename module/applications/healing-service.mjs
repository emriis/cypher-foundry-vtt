/**
 * Apply CRD treatment and Healing Hand to actual target Actors. Caller-confirmed
 * duration/contact precedes any cost. Guards prevent local overlapping healing;
 * sequential writes to different Actors are not an atomic Foundry transaction.
 */
import { healingHandUpdates, treatmentProfile } from "../rules/healing.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { rollTask } from "./task-service.mjs";
import { syncHealingStatuses } from "./wound-removal.mjs";

function itemsOf(actor) {
  return actor.items?.contents ?? (Array.isArray(actor.items) ? actor.items : Array.from(actor.items?.values?.() ?? []));
}

function withHealingTargets(healer, target, execute) {
  return runActorActions([healer, target], "healing", execute);
}

/** Stable source key dispatch; translated names never activate a rule. */
export function getHealingAbilityKind(item) {
  return item?.type === "ability" && item.system?.key === "healing-hand" ? "healing-hand" : null;
}

/** Read the next Healing Hand cost, including tracked escalation and effective Edge. */
export function getHealingHandCost(item) {
  if (!getHealingAbilityKind(item) || item.actor?.type !== "pc") return null;
  const healer = item.actor;
  const prior = healer.flags?.cypher?.healingUses?.["healing-hand"] ?? 0;
  const modifiers = resolveActiveAbilityModifiers(healer.system.activeAbilityEffects, itemsOf(healer));
  return Math.max(0, 1 + prior - (healer.system.stats.intellect.edge ?? 0) - (modifiers.edge.intellect ?? 0));
}

/** Read the required task/time profile for presentation and fresh validation. */
export function getTreatmentProfile(target, severity, profile = "standard") {
  const machine = itemsOf(target).some(item => item.system?.key === "machine-not-flesh");
  return treatmentProfile(severity, profile, machine);
}

/**
 * Complete treatment after both participants spent the confirmed time. A normal
 * Healing/Engineering task determines success; only success removes a wound.
 * Effort follows the existing task engine. Treatment itself charges no Might.
 * @param {Actor} healer PC making the Intellect task.
 * @param {object} options Actual PC target, severity, time profile and task choices.
 * @returns {Promise<object|null>} Task result, or null before mutation if rejected.
 */
export async function treatWound(healer, { target = healer, severity, timeProfile = "standard", completed = false, rollOptions = {} } = {}) {
  if (healer?.type !== "pc" || target?.type !== "pc" || healer.isOwner === false || target.isOwner === false || completed !== true) return null;
  return withHealingTargets(healer, target, async context => {
    const profile = getTreatmentProfile(target, severity, timeProfile);
    if (!profile || !(target.system.wounds[severity]?.current > 0)) return null;
    const result = await rollTask(healer, { ...rollOptions, [ACTION_CONTEXT]: context, stat: "intellect", difficulty: profile.difficulty,
      targetActor: target, woundRemovalSeverity: severity,
      flavor: game.i18n.localize("CYPHER.Healing.Treatment") });
    return result;
  });
}

/**
 * Healing Hand reduces one PC wound or restores five NPC Health (Cleric CRD
 * callout). Each successful use adds one to the next base Intellect cost; any
 * recovery clears that counter. Edge applies once. Rejected contact, capacity,
 * ownership or insufficient Pools leaves both documents and the counter intact.
 * After the healer write, target-write failure is propagated without a stale
 * refund; chat is published only after all required writes succeed.
 * @param {Item} item Healing Hand embedded in the acting PC.
 * @param {object} options Actual target, PC severity and confirmed valid contact.
 * @returns {Promise<object|null>} Paid cost and target updates, or null if rejected.
 */
export async function useHealingHand(item, { target = item?.actor, severity = "minor", touchConfirmed = false } = {}) {
  const healer = item?.actor;
  if (!getHealingAbilityKind(item) || healer?.type !== "pc" || item.parent !== healer || healer.isOwner === false
    || !["pc", "npc"].includes(target?.type) || target.isOwner === false || touchConfirmed !== true) return null;
  return withHealingTargets(healer, target, async () => {
    const targetModifiers = resolveActiveAbilityModifiers(target.system.activeAbilityEffects, itemsOf(target));
    const wounds = target.type === "pc" ? Object.fromEntries(Object.entries(target.system.wounds).map(([key, wound]) =>
      [key, { current: wound.current, max: wound.max + (targetModifiers.woundCapacity[key] ?? 0) }])) : null;
    const targetUpdates = target.type === "pc" ? healingHandUpdates(wounds, severity)
      : target.system.health.value < target.system.health.max
        ? { "system.health.value": Math.min(target.system.health.max, target.system.health.value + 5) } : null;
    if (!targetUpdates) return null;
    const uses = healer.flags?.cypher?.healingUses ?? {};
    const prior = Math.max(0, uses["healing-hand"] ?? 0);
    const pool = healer.system.stats.intellect;
    const cost = getHealingHandCost(item);
    if (pool.pool.value < cost) return null;
    const healerUpdates = { "system.stats.intellect.pool.value": pool.pool.value - cost,
      "flags.cypher.healingUses": { ...uses, "healing-hand": prior + 1 } };
    if (target === healer) await healer.update({ ...healerUpdates, ...targetUpdates });
    else {
      await healer.update(healerUpdates);
      await target.update(targetUpdates);
    }
    await syncHealingStatuses(target);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: healer }),
      content: `<p>${game.i18n.format("CYPHER.Healing.HandResult", {
        name: foundry.utils.escapeHTML(target.name), cost
      })}</p>` });
    return { cost, targetUpdates };
  });
}
