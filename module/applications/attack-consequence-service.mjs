/** CRD / Special Rolls and Rerolling: persist one NPC attack's actual contribution. */
import { resolveNpcDamage } from "../rules/wounds.mjs";
import { planAttackDamage } from "../rules/attack-consequences.mjs";
import { applyNpcDamage } from "./damage-service.mjs";
import { attackHealthRevision } from "./attack-history.mjs";
import { applyWeaponTargetEffects, weaponEffectContext } from "./weapon-effect-service.mjs";

/**
 * Record misses as well as hits before publishing the original attack card.
 * @param {Actor} target Actual NPC, including an unlinked token's Actor.
 * @param {object} context Resolved success, numeric damage, bypass and weapon effects.
 * @returns {Promise<object>} Post-Armor damage and persisted Health/effect attribution.
 */
export async function applyAttackConsequences(target, { success, totalDamage, armorBypass, weaponTargetEffects, weaponSource }) {
  const armor = target.system.armor ?? 0;
  const before = target.system.health?.value;
  const healthRevision = attackHealthRevision(target);
  const effectContext = weaponEffectContext(target);
  let targetDamage = 0;
  if (success) {
    if (totalDamage > 0) targetDamage = await applyNpcDamage(target, totalDamage, { armorBypass });
    await applyWeaponTargetEffects(target, weaponTargetEffects, weaponSource, effectContext);
  }
  const loss = before - target.system.health?.value;
  const resolvedDamage = success ? resolveNpcDamage(totalDamage, armor, armorBypass) : 0;
  return { targetDamage, attackConsequences: { version: 1, state: "applied", targetUuid: target.uuid,
    armor, armorBypass, resolvedDamage, damageBands: loss > 0 ? [{ from: 0, to: loss }] : [],
    healthRevision, success, effectsApplied: success, effectContext } };
}

/**
 * Correct only tracked damage and newly earned structured effects. A persisted
 * pending checkpoint precedes any target write. Uncertain partial completion,
 * legacy cards or intervening healing require explicit GM reconciliation.
 * @param {Actor|null} target Original NPC resolved by UUID.
 * @param {object} flags Authoritative accepted chat flags.
 * @param {object} outcome Retained task outcome.
 * @param {Function} checkpoint Persist pending history before any state change.
 * @returns {Promise<object>} Updated history and localized result note.
 */
export async function reconcileAttackConsequences(target, flags, outcome, checkpoint) {
  const history = flags.attackConsequences;
  const manual = reason => ({ attackConsequences: { ...history, state: "manual", reason },
    attackNote: "CYPHER.XP.AttackCorrectionManual" });
  if (history?.state === "pending" || history?.reason === "partial") return manual("partial");
  if (!history || history.version !== 1 || !target || history.state === "manual") return manual(history?.reason ?? "history");
  if (history.state !== "applied" || typeof history.success !== "boolean" || typeof history.effectsApplied !== "boolean"
    || ![history.armor, history.armorBypass].every(value => Number.isSafeInteger(value) && value >= 0)) return manual("history");
  const damage = outcome.success ? resolveNpcDamage(outcome.totalDamage, history.armor, history.armorBypass) : 0;
  const plan = planAttackDamage(history, damage, target.system.health?.value, target.system.health?.max, attackHealthRevision(target));
  if (!plan) return manual("history");
  const effects = outcome.success && !history.effectsApplied;
  const interval = history.effectContext;
  if (effects && flags.weaponTargetEffects?.length && (!interval
    || !Number.isSafeInteger(interval.appliedAt) || !Number.isSafeInteger(interval.actionRevision)
    || interval.actionRevision < 0
    || !(interval.combatId === null && interval.combatRound === null
      || typeof interval.combatId === "string" && Number.isSafeInteger(interval.combatRound)))) return manual("history");
  const next = { ...history, ...plan, success: outcome.success, effectsApplied: history.effectsApplied || outcome.success, state: "applied" };
  delete next.health;
  if (plan.health !== target.system.health.value || effects && flags.weaponTargetEffects?.length) {
    await checkpoint({ ...next, state: "pending" });
    if (plan.health !== target.system.health.value) await target.update({ "system.health.value": plan.health }, { cypherAttackCorrection: true });
    if (effects) await applyWeaponTargetEffects(target, flags.weaponTargetEffects, flags.weaponSource, history.effectContext);
  }
  return { attackConsequences: next, attackNote: "CYPHER.XP.AttackCorrectionApplied" };
}
