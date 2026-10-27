import { speciesDamageReduction } from "./species-benefit-service.mjs";
/** Persist defense consequences and reconcile a failed defense once its reroll succeeds. */
import { CYPHER } from "../config.mjs";
import { planDefenseCorrection } from "../rules/defense-correction.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { canShieldAbsorbWound } from "../rules/wounds.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { resolveTaskOutcome } from "../rules/task-outcome.mjs";
import { addWound, applyDamage, reduceWound, shieldAbsorbWound, syncWoundStatusEffects } from "./damage-service.mjs";
import { defenseRevision } from "./defense-history.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";

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
  incomingDamageTags = [], incomingSeverity, incomingWounds, usingShield, shieldItem, incomingPoolDamage = null,
  conditionsOnFailure = [], additionalMinorWound = false, specialistRequired = false, actionContext }) {
  const before = woundCounts(actor);
  const revisions = woundRevisions(actor);
  const pool = incomingPoolDamage ? resolveStat(actor.system, incomingPoolDamage.stat) : null;
  const poolRevision = incomingPoolDamage ? defenseRevision(actor, `pool_${incomingPoolDamage.stat}`) : null;
  let shieldWoundsAbsorbed = 0, defensePoolDamage = 0;
  if (!success && incomingPoolDamage) {
    defensePoolDamage = await applyDamage(actor, incomingPoolDamage.amount, { stat: incomingPoolDamage.stat });
  }
  if (applyIncomingWound) {
    let severity = success ? defenseType === "block" ? reduceWound(incomingSeverity) : null : incomingSeverity;
    for (let step = 0; severity && step < speciesDamageReduction(actor, incomingDamageTags); step++) severity = reduceWound(severity);
    for (let index = 0; index < incomingWounds; index++) {
      if (success && defenseType === "block" && usingShield
        && await shieldAbsorbWound(actor, shieldItem, incomingSeverity, actionContext)) shieldWoundsAbsorbed++;
      else if (severity) await addWound(actor, severity);
    }
  }
  if (additionalMinorWound) await addWound(actor, "minor");
  const effects = !success ? conditionsOnFailure.map(effect => ({ ...effect, id: foundry.utils.randomID() })) : [];
  const after = woundCounts(actor);
  if (!success && specialistRequired) effects.push({ id: foundry.utils.randomID(), kind: "restrictedDamage",
    wounds: Object.fromEntries(CYPHER.woundSeverities.map(severity => [severity, Math.max(0, after[severity] - before[severity])])),
    pool: defensePoolDamage > 0 ? { stat: incomingPoolDamage.stat, amount: defensePoolDamage } : null });
  if (effects.length) await actor.update({ "flags.cypher.generalEffects": [...getGeneralEffects(actor), ...effects] });
  const contribution = { version: 1, state: "applied", success,
    ...(actor.uuid ? { recipientUuid: actor.uuid } : {}),
    wounds: Object.fromEntries(CYPHER.woundSeverities.map(severity => [severity, Math.max(0, after[severity] - before[severity])])),
    revisions, effects: effects.map(effect => effect.id),
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
export async function reconcileDefenseConsequences(actor, flags, outcome, checkpoint, actionContext, recipient = actor) {
  const contribution = flags.defenseConsequences;
  if (!outcome.success || contribution?.success === true || contribution?.state === "corrected") return {};
  if (!contribution && resolveTaskOutcome(flags).success) return {};
  if (flags.takeOnSuccessfulBlock && contribution?.recipientUuid !== actor?.uuid) {
    // A successful Block still leaves a hit after reduction/overflow. The
    // declared interception therefore still applies in full, without replay.
    return { defenseConsequences: { ...contribution, success: true, state: "corrected" } };
  }
  const manual = () => ({ defenseConsequences: { ...contribution, version: contribution?.version ?? 1, state: "manual",
    reason: contribution?.state === "pending" ? "partial" : contribution?.reason ?? "attribution" },
    defenseNote: "CYPHER.XP.DefenseCorrectionManual" });
  if (!actor || actor.isOwner === false || !recipient || recipient.isOwner === false) return manual();
  if (!["block", "dodge", "might", "speed", "intellect"].includes(flags.defenseType) || !CYPHER.woundSeverities.includes(flags.incomingSeverity)
    || !Number.isSafeInteger(flags.incomingWounds) || flags.incomingWounds < 1 || typeof flags.applyIncomingWound !== "boolean") return manual();
  const resolved = contribution?.pool ? resolveStat(recipient.system, contribution.pool.stat) : null;
  const items = recipient.items?.contents ?? Array.from(recipient.items?.values?.() ?? []);
  const modifiers = resolveActiveAbilityModifiers(recipient.system.activeAbilityEffects, items, recipient.system);
  const pool = resolved ? { value: resolved.data.pool.value,
    max: resolved.data.pool.max + (modifiers.poolMax[contribution.pool.stat] ?? 0),
    revision: defenseRevision(recipient, `pool_${contribution.pool.stat}`), path: `${resolved.path}.pool.value` } : null;
  const updates = planDefenseCorrection({ contribution, wounds: recipient.system.wounds, revisions: woundRevisions(recipient), pool });
  if (!updates) return manual();
  const shield = flags.shieldItemId ? actor.items.get(flags.shieldItemId) : null;
  if (canShieldAbsorbWound(shield) && shield.isOwner === false) return manual();

  await checkpoint({ ...contribution, state: "pending" });
  if (Object.keys(updates).length) {
    // This removes a known contribution, not an arbitrary healed wound. Other
    // defense cards retain attribution; no saved historical totals are restored.
    await recipient.update(updates, { cypherDefenseCorrection: true });
    if (typeof recipient.toggleStatusEffect === "function") await syncWoundStatusEffects(recipient);
  }
  if (contribution.effects?.length) await recipient.update({ "flags.cypher.generalEffects":
    getGeneralEffects(recipient).filter(effect => !contribution.effects.includes(effect.id)) });
  const applied = await applyDefenseConsequences(actor, { defenseType: flags.defenseType, success: true,
    applyIncomingWound: flags.applyIncomingWound, incomingSeverity: flags.incomingSeverity,
    incomingWounds: flags.incomingWounds, incomingPoolDamage: flags.incomingPoolDamage, incomingDamageTags: flags.incomingDamageTags ?? [],
    usingShield: canShieldAbsorbWound(shield), shieldItem: shield, actionContext });
  return { ...applied, defenseConsequences: { ...applied.defenseConsequences, state: "corrected" },
    defenseNote: "CYPHER.XP.DefenseCorrectionApplied" };
}
