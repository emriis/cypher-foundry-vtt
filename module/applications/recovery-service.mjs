/**
 * CRD Recoveries / Healing Wounds: commit a completed rest or Rally on its
 * actual Actor. Sheets collect choices; this service validates fresh state,
 * distributes points, persists benefits, then expires effects and publishes chat.
 */
import { computeRallyResult, computeRecoveryUpdates, getRallyCost, getRecoveryRollData } from "../rules/recovery.mjs";
import { defaultRecoveryAllocation, recoveryPoolUpdates } from "../rules/recovery-points.mjs";
import { recoverySources } from "../rules/recovery-sources.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { expireAbilityEffectsOnRecovery } from "./ability-runtime-service.mjs";
import { runActorAction } from "./action-guard.mjs";
import { rollTask } from "./task-service.mjs";
import { syncHealingStatuses } from "./wound-removal.mjs";

function itemsOf(actor) {
  return actor.items?.contents ?? (Array.isArray(actor.items) ? actor.items : Array.from(actor.items?.values?.() ?? []));
}

// Foundry merges nested flag objects: an empty map retains old values. Write
// each existing counter explicitly, preserving its identity and unrelated flags.
function resetCounters(counters = {}) {
  return Object.fromEntries(Object.keys(counters).map(key => [key, 0]));
}

/** Read effective Pool maxima, including declared active Ability modifiers. */
export function getRecoveryPools(actor) {
  const modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, itemsOf(actor));
  return Object.fromEntries(Object.entries(actor.system.stats ?? {}).map(([stat, data]) =>
    [stat, { value: data.pool.value, max: data.pool.max + (modifiers.poolMax[stat] ?? 0) }]));
}

/** Read source allowances without changing booleans or optional extra-use flags. */
export function getRecoverySources(actor, interval) {
  return recoverySources(actor.system, itemsOf(actor), actor.flags?.cypher ?? {}, interval);
}

function availableSource(actor, interval, sourceId, powered) {
  return getRecoverySources(actor, interval).find(source => source.id === sourceId && source.remaining > 0
    && (!source.requiresPower || powered === true));
}

/**
 * Complete one selected allowance in any order. Calling this API declares that
 * the rest finished; the sheet explicitly confirms duration/power before calling.
 * Defaults allocate Might, then Speed, then Intellect for existing macros.
 * Rejection/cancelled allocation changes no state. A ten-hour completion opens
 * a new day. Local guards prevent overlapping healing actions on this client;
 * later chat/effect failures do not roll back earlier document writes.
 * @param {Actor} actor Actual PC, including an unlinked token Actor.
 * @param {string} [interval="hour"] CRD recovery interval.
 * @param {object} [options={}] Source, Last action, wound choice and allocation.
 * @param {Function} [options.allocate] Read-only callback returning points or null to cancel.
 * @returns {Promise<Roll|null>} Committed roll, or null when rejected/cancelled.
 */
export async function rollRecovery(actor, interval = "hour", options = {}) {
  if (actor?.type !== "pc" || actor.isOwner === false || (options.completed !== undefined && options.completed !== true)) return null;
  return runActorAction(actor, "healing", async () => {
    const sourceId = options.source ?? "standard";
    const source = availableSource(actor, interval, sourceId, options.machinePowered);
    if (!source) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Recovery.Unavailable"));
      return null;
    }
    if ((options.lastAction && interval !== "action")
      || (options.healMajor && interval !== "tenHours")
      || (options.woundChoice && !["minor", "moderate"].includes(options.woundChoice))) return null;
    const { formula, data } = getRecoveryRollData(actor.system.tier ?? 1, actor.system.recoveryBonus ?? 0, options);
    const roll = await new Roll(formula, data).evaluate();
    const pools = getRecoveryPools(actor);
    const proposed = defaultRecoveryAllocation(roll.total, pools, source.allowedStats);
    const allocation = options.allocate
      ? await options.allocate({ total: roll.total, pools, allowedStats: source.allowedStats, proposed })
      : options.allocation ?? proposed;
    if (!availableSource(actor, interval, sourceId, options.machinePowered) || actor.isOwner === false) return null;
    const poolUpdates = recoveryPoolUpdates(roll.total, getRecoveryPools(actor), allocation, source.allowedStats);
    if (!poolUpdates) {
      if (allocation !== null) ui.notifications.warn(game.i18n.localize("CYPHER.Recovery.InvalidAllocation"));
      return null;
    }
    const { updates, woundNoteKey } = computeRecoveryUpdates(interval, actor.system.wounds,
      actor.system.recoveries, { woundChoice: options.woundChoice, additional: sourceId !== "standard" });
    const flags = actor.flags?.cypher ?? {};
    if (sourceId !== "standard") updates["flags.cypher.additionalRecoveriesUsed"] = {
      ...flags.additionalRecoveriesUsed, [sourceId]: source.used + 1
    };
    if (interval === "tenHours") {
      updates["flags.cypher.additionalRecoveriesUsed"] = resetCounters(flags.additionalRecoveriesUsed);
      updates["flags.cypher.healingUses"] = resetCounters(flags.healingUses);
      if (itemsOf(actor).some(item => item.system?.key === "machine-not-flesh")) {
        updates["flags.cypher.machineRecoveryPowerRequired"] = options.machinePowered !== true;
      }
    } else {
      // Healing Hand escalation resets on any actual recovery, not a checkbox edit.
      if (flags.healingUses) updates["flags.cypher.healingUses"] = resetCounters(flags.healingUses);
      if (options.machinePowered && flags.machineRecoveryPowerRequired) updates["flags.cypher.machineRecoveryPowerRequired"] = false;
    }
    await actor.update({ ...poolUpdates, ...updates });
    await expireAbilityEffectsOnRecovery(actor, interval);
    await syncHealingStatuses(actor);
    // The Might task follows completion: restored Pools can fund its Effort.
    // Failure leaves the normal recovery benefits and consumption intact.
    if (options.healMajor && actor.system.wounds.major.current > 0) {
      await rollTask(actor, { ...options.majorTaskOptions, stat: "might", difficulty: 6,
        targetActor: actor, woundRemovalSeverity: "major",
        flavor: game.i18n.localize("CYPHER.Recovery.MajorTask") });
    }
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flags: { cypher: { rerollable: true, rollType: "recovery", actorId: actor.id, actorUuid: actor.uuid, rollFormula: formula,
        rollData: data, originalRoll: roll.total, recoveryApplied: true, recoveryAllowedStats: source.allowedStats } },
      flavor: `<h3>${game.i18n.localize("CYPHER.Roll.Recovery")}</h3><p>${game.i18n.localize(`CYPHER.Recovery.${interval}`)}</p>
        ${woundNoteKey ? `<p>${game.i18n.localize(woundNoteKey)}</p>` : ""}`
    });
    return roll;
  });
}

/**
 * Spend Might without Edge and remove one existing wound; superhero permission
 * allows a major wound for ten Might. Validate before dice-free persistence.
 * @param {Actor} actor Actual PC whose Pool and wounds change together.
 * @param {string} severity Minor, moderate, or source-permitted major wound.
 * @returns {Promise<boolean|null>} True after persistence; false for rejection, null for overlap.
 */
export async function rallyWound(actor, severity) {
  if (actor?.type !== "pc" || actor.isOwner === false) return false;
  return runActorAction(actor, "healing", async () => {
    const cost = getRallyCost(severity, actor.system.canRallyMajor);
    if (cost === null) {
      if (severity === "major") ui.notifications.warn(game.i18n.localize("CYPHER.Warning.CannotRallyMajor"));
      return false;
    }
    const result = computeRallyResult(severity, actor.system.stats.might.pool.value,
      actor.system.wounds, actor.system.canRallyMajor);
    if (!result) {
      if (actor.system.stats.might.pool.value < cost) ui.notifications.warn(game.i18n.localize("CYPHER.Warning.NotEnoughMightToRally"));
      return false;
    }
    await actor.update({ "system.stats.might.pool.value": result.remainingMight,
      [`system.wounds.${severity}.current`]: result.remainingWound });
    await syncHealingStatuses(actor);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${game.i18n.format("CYPHER.Roll.Rallied", {
        name: globalThis.foundry?.utils?.escapeHTML?.(actor.name) ?? actor.name, severity: game.i18n.localize(`CYPHER.Wound.${severity}`)
      })}</p>` });
    return true;
  });
}
