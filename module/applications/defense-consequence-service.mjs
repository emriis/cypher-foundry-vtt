/** Persist defense consequences and reconcile a failed defense once its reroll succeeds. */
import { CYPHER } from "../config.mjs";
import { planDefenseCorrection } from "../rules/defense-correction.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { canShieldAbsorbWound } from "../rules/wounds.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { resolveTaskOutcome } from "../rules/task-outcome.mjs";
import { addWound, applyDamage, reduceWound, shieldAbsorbWound, syncWoundStatusEffects } from "./damage-service.mjs";
import { defenseRevision } from "./defense-history.mjs";

const woundCounts = actor => Object.fromEntries(CYPHER.woundSeverities.map(severity => [severity, actor.system.wounds?.[severity]?.current ?? 0]));
const woundRevisions = actor => Object.fromEntries(CYPHER.woundSeverities.map(severity => [severity, defenseRevision(actor, `wound_${severity}`)]));

/**
 * Apply only the defense branch. Record actual added tiers after overflow,
 * excluding task costs and any push wound. Pool damage also belongs here so
 * NPC attacks publish their chat only after recording all consequences.
 * @param {Actor} actor Actual defending PC.
 * @param {object} context Accepted defense inputs and explicit parent action context.
 * @returns {Promise<object>} Recorded contribution, absorption count and Pool damage.
 */
export async function applyDefenseConsequences(actor, { defenseType, success, applyIncomingWound,
  incomingSeverity, incomingWounds, usingShield, shieldItem, incomingPoolDamage = null, actionContext }) {
  const before = woundCounts(actor);
  const revisions = woundRevisions(actor);
  const pool = incomingPoolDamage ? resolveStat(actor.system, incomingPoolDamage.stat) : null;
  const poolRevision = incomingPoolDamage ? defenseRevision(actor, `pool_${incomingPoolDamage.stat}`) : null;
  let shieldWoundsAbsorbed = 0, defensePoolDamage = 0;
  if (!success && incomingPoolDamage) {
    defensePoolDamage = await applyDamage(actor, incomingPoolDamage.amount, { stat: incomingPoolDamage.stat });
  } else if (applyIncomingWound) {
    const severity = success ? defenseType === "block" ? reduceWound(incomingSeverity) : null : incomingSeverity;
    for (let index = 0; index < incomingWounds; index++) {
      if (success && defenseType === "block" && usingShield
        && await shieldAbsorbWound(actor, shieldItem, incomingSeverity, actionContext)) shieldWoundsAbsorbed++;
      else if (severity) await addWound(actor, severity);
    }
  }
  const after = woundCounts(actor);
  const contribution = { version: 1, state: "applied", success,
    wounds: Object.fromEntries(CYPHER.woundSeverities.map(severity => [severity, Math.max(0, after[severity] - before[severity])])),
    revisions,
    pool: pool && defensePoolDamage > 0 ? { stat: incomingPoolDamage.stat, amount: defensePoolDamage,
      revision: poolRevision } : null };
  // An external healing write during awaited consequences destroys attribution.
  // Cross-client writes are not serialized by the client-local action guard.
  if (CYPHER.woundSeverities.some(severity => revisions[severity] !== woundRevisions(actor)[severity])
    || (incomingPoolDamage && poolRevision !== defenseRevision(actor, `pool_${incomingPoolDamage.stat}`))) contribution.state = "manual";
  return { defenseConsequences: contribution, shieldWoundsAbsorbed, defensePoolDamage };
}

/**
 * Correct only a failure that became a success. The caller has reserved the
 * actual defender and payer. A pending checkpoint is persisted before the first
 * consequence write, so a partial failure cannot remove the same wounds twice.
 * Missing history or intervening healing requires explicit GM reconciliation.
 * @param {Actor} actor Actual defender resolved from the origin message UUID.
 * @param {object} flags Authoritative original-message metadata.
 * @param {object} outcome Retained task outcome.
 * @param {Function} checkpoint Persist pending metadata on the original message.
 * @param {object} actionContext Parent reroll reservation context.
 * @returns {Promise<object>} Updated contribution metadata and localized result-note key.
 */
export async function reconcileDefenseConsequences(actor, flags, outcome, checkpoint, actionContext) {
  const contribution = flags.defenseConsequences;
  if (!outcome.success || contribution?.success === true || contribution?.state === "corrected") return {};
  if (!contribution && resolveTaskOutcome(flags).success) return {};
  const manual = () => ({ defenseConsequences: { ...contribution, version: contribution?.version ?? 1, state: "manual",
    reason: contribution?.state === "pending" ? "partial" : contribution?.reason ?? "attribution" },
    defenseNote: "CYPHER.XP.DefenseCorrectionManual" });
  if (!actor || actor.isOwner === false) return manual();
  if (!["block", "dodge"].includes(flags.defenseType) || !CYPHER.woundSeverities.includes(flags.incomingSeverity)
    || !Number.isSafeInteger(flags.incomingWounds) || flags.incomingWounds < 1 || typeof flags.applyIncomingWound !== "boolean") return manual();
  const resolved = contribution?.pool ? resolveStat(actor.system, contribution.pool.stat) : null;
  const items = actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);
  const modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, items, actor.system);
  const pool = resolved ? { value: resolved.data.pool.value,
    max: resolved.data.pool.max + (modifiers.poolMax[contribution.pool.stat] ?? 0),
    revision: defenseRevision(actor, `pool_${contribution.pool.stat}`), path: `${resolved.path}.pool.value` } : null;
  const updates = planDefenseCorrection({ contribution, wounds: actor.system.wounds, revisions: woundRevisions(actor), pool });
  if (!updates) return manual();
  const shield = flags.shieldItemId ? actor.items.get(flags.shieldItemId) : null;
  if (canShieldAbsorbWound(shield) && shield.isOwner === false) return manual();

  await checkpoint({ ...contribution, state: "pending" });
  if (Object.keys(updates).length) {
    // This removes a known contribution, not an arbitrary healed wound. Other
    // defense cards retain attribution; no saved historical totals are restored.
    await actor.update(updates, { cypherDefenseCorrection: true });
    if (typeof actor.toggleStatusEffect === "function") await syncWoundStatusEffects(actor);
  }
  const applied = await applyDefenseConsequences(actor, { defenseType: flags.defenseType, success: true,
    applyIncomingWound: flags.applyIncomingWound, incomingSeverity: flags.incomingSeverity,
    incomingWounds: flags.incomingWounds, incomingPoolDamage: flags.incomingPoolDamage,
    usingShield: canShieldAbsorbWound(shield), shieldItem: shield, actionContext });
  return { ...applied, defenseConsequences: { ...applied.defenseConsequences, state: "corrected" },
    defenseNote: "CYPHER.XP.DefenseCorrectionApplied" };
}
