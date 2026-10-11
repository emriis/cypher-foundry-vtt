/** Shared persistence for one source-backed treatment/rest wound removal. */
import { syncWoundStatusEffects } from "./damage-service.mjs";

/** Synchronize real Actor token statuses; compatibility facades can lack token APIs. */
export async function syncHealingStatuses(actor) {
  if (typeof actor.toggleStatusEffect === "function") await syncWoundStatusEffects(actor);
}

/**
 * Remove one existing wound on the actual target, retaining synthetic identity.
 * Called after the task succeeds, before its chat card is published. The caller
 * owns the local action guard; this mutation is not a cross-client lock.
 * @param {Actor} target Affected PC.
 * @param {string} severity Source-selected severity.
 * @returns {Promise<boolean>} True after persistence, false if no valid wound remains.
 */
export async function removeWound(target, severity) {
  if (target?.type !== "pc" || target.isOwner === false || !["minor", "moderate", "major"].includes(severity)
    || !(target.system.wounds[severity].current > 0)) return false;
  await target.update({ [`system.wounds.${severity}.current`]: target.system.wounds[severity].current - 1 });
  await syncHealingStatuses(target);
  return true;
}
