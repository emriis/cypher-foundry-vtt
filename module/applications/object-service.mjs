/**
 * Object attacks and retained-result correction. Plans freeze the pre-roll
 * material/level profile; counters are damage points, never Health or wounds.
 * Callers reserve the actual target with their task/reroll action context.
 * Manual GM entry points below acquire their own client-local reservation.
 */
import { objectState, resolveObjectDamage } from "../rules/objects.mjs";
import { runActorAction } from "./action-guard.mjs";
const revision = actor => actor.flags?.cypher?.objectRevision ?? 0;
const snapshot = actor => {
  const state = objectState(actor.system);
  if (!state) return null;
  const { level: _level, status: _status, ...stored } = state;
  return stored;
};

/** Advance attribution with the same edit, including manual damage, reset and material changes. */
export function stampObjectRevision(actor, changes) {
  if (actor.type !== "object") return;
  const touched = ["originalLevel", "levelDamage", "destructionDamage", "physical", "material"].some(key =>
    Object.hasOwn(changes, `system.${key}`) && changes[`system.${key}`] !== actor.system[key]
    || changes.system && Object.hasOwn(changes.system, key) && changes.system[key] !== actor.system[key]);
  if (touched) changes["flags.cypher.objectRevision"] = revision(actor) + 1;
}

/**
 * Validate material intent before costs. Source mechanics come only from the
 * actual owned weapon; names/price never establish hardness.
 * @param {Actor} actor Attacking PC owning the declared weapon.
 * @param {Actor} target Actual world or synthetic Object Actor.
 * @param {object|null} interaction Explicit method, hardness and optional dialog revision.
 * @param {object} [weaponSource={}] Embedded weapon identity, not caller-supplied mechanics.
 * @returns {object|null} Frozen pre-roll state/profile, or null for invalid/stale intent.
 */
export function prepareObjectAttack(actor, target, interaction, weaponSource = {}) {
  const before = target?.type === "object" && snapshot(target);
  if (!before || target.isOwner === false || objectState(before).status === "destroyed"
    || !["physicalTool", "other"].includes(interaction?.method)
    || interaction.targetUuid && interaction.targetUuid !== target.uuid
    || interaction.revision !== undefined && interaction.revision !== revision(target)) return null;
  const weapon = weaponSource.itemId ? actor.items?.get?.(weaponSource.itemId) : null;
  if (weaponSource.itemId && (!weapon || weapon.isOwner === false || !["attack", "shield"].includes(weapon.type))) return null;
  const profile = { usesPhysicalTool: interaction.method === "physicalTool", toolHardEnough: interaction.toolHardEnough ?? null,
    cutLevel: weapon?.system.mechanics?.cutsThroughMaterialsLevel ?? null,
    armorBypass: weapon?.system.mechanics?.ignoresPhysicalArmor ?? 0 };
  if (!resolveObjectDamage(before, 0, profile)) return null;
  return { before, revision: revision(target), profile };
}

async function persistDamage(target, next) {
  if (next.levelDamage !== target.system.levelDamage || next.destructionDamage !== target.system.destructionDamage) {
    await target.update({ "system.levelDamage": next.levelDamage, "system.destructionDamage": next.destructionDamage,
      "flags.cypher.objectRevision": revision(target) + 1 });
  }
}

/**
 * Persist one validated task contribution before chat publication. Asynchronous
 * target changes during the roll require GM reconciliation instead of rollback.
 * @param {Actor} target Target reserved by the task caller.
 * @param {object} plan Accepted prepareObjectAttack result.
 * @param {boolean} success Retained attack outcome.
 * @param {number} totalDamage Raw integer damage including Effort and special-roll bonuses.
 * @returns {Promise<object>} Applied damage points and serializable attribution history.
 */
export async function applyObjectConsequences(target, plan, success, totalDamage) {
  const history = { version: 1, state: "applied", reason: null, targetUuid: target.uuid, before: plan.before,
    after: snapshot(target), revision: revision(target), profile: plan.profile, success };
  if (target.isOwner === false || revision(target) !== plan.revision || JSON.stringify(snapshot(target)) !== JSON.stringify(plan.before)) {
    return { targetDamage: 0, objectConsequences: { ...history, state: "manual", reason: "changed" } };
  }
  const hit = resolveObjectDamage(plan.before, success ? totalDamage : 0, plan.profile);
  await persistDamage(target, hit.system);
  return { targetDamage: hit.appliedDamage, objectConsequences: { ...history, after: snapshot(target), revision: revision(target),
    armor: hit.armor, cuts: hit.cuts, ineffective: hit.ineffective } };
}

/**
 * Replace only the last unchanged contribution; later damage is never erased.
 * @param {Actor|null} target Original target reserved by the reroll caller.
 * @param {object} flags Saved authoritative message flags.
 * @param {object} outcome Retained success and totalDamage, without repeating costs.
 * @param {Function} checkpoint Persist pending metadata before any target correction.
 * @returns {Promise<object>} Replacement history and a localized correction/manual note key.
 */
export async function reconcileObjectConsequences(target, flags, outcome, checkpoint) {
  const history = flags.objectConsequences;
  const manual = reason => ({ objectConsequences: { ...history, state: "manual", reason }, attackNote: "CYPHER.Object.manual" });
  if (history?.state === "pending" || history?.reason === "partial") return manual("partial");
  if (!target || history?.version !== 1 || history.state !== "applied") return manual(history?.reason ?? "history");
  if (revision(target) !== history.revision || JSON.stringify(snapshot(target)) !== JSON.stringify(history.after)) return manual("changed");
  const hit = resolveObjectDamage(history.before, outcome.success ? outcome.totalDamage : 0, history.profile);
  if (!hit) return manual("history");
  if (hit.system.levelDamage !== target.system.levelDamage || hit.system.destructionDamage !== target.system.destructionDamage) {
    await checkpoint({ ...history, state: "pending", reason: "partial" });
    await persistDamage(target, hit.system);
  }
  // Foundry merges nested flags: clear the temporary reason explicitly so it
  // cannot survive a successful pending -> applied transition on the card.
  return { objectConsequences: { ...history, reason: null, success: outcome.success, after: snapshot(target), revision: revision(target) },
    attackNote: "CYPHER.Object.corrected" };
}

/** Manual damage is an explicit GM adjudication, not a player bypass of attack costs or tool checks. */
export async function damageObject(target, amount) {
  if (target?.type !== "object" || target.isOwner === false || !game.user?.isGM) return false;
  return Boolean(await runActorAction(target, "objectDamage", async () => {
    const hit = resolveObjectDamage(snapshot(target), amount, { usesPhysicalTool: false, toolHardEnough: null, cutLevel: null, armorBypass: 0 });
    if (!hit) return false;
    await persistDamage(target, hit.system);
    return true;
  }));
}

/** Authoring reset follows explicit GM adjudication; it does not implement resource-point repair. */
export async function resetObject(target, { confirmed = false } = {}) {
  if (target?.type !== "object" || target.isOwner === false || !game.user?.isGM || !confirmed) return false;
  return Boolean(await runActorAction(target, "objectDamage", async () => {
    await target.update({ "system.levelDamage": 0, "system.destructionDamage": 0, "flags.cypher.objectRevision": revision(target) + 1 });
    return true;
  }));
}

/** Read-only sheet projection, including a visible invalid-state boundary after raw/manual edits. */
export function objectDisplay(actor) { return objectState(actor.system) ?? { status: "invalid", level: 0 }; }
