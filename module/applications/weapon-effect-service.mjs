/**
 * Persist and resolve source-backed weapon effects on NPC targets.
 *
 * Only explicit structured effects and their declared durations are stored.
 * Combat-round effects are scoped to the combat and round in which they apply.
 */

import {
  consumeWeaponEffectAction, resolveWeaponEffectStacking, weaponEffectIsActive, weaponEffectRounds
} from "../rules/weapon-effect-duration.mjs";
import { runActorAction } from "./action-guard.mjs";

const EFFECTS_FLAG = "flags.cypher.activeWeaponEffects";

/**
 * Freeze the original interval so a paid reroll cannot restart an expired effect.
 * @param {Actor} actor Actual NPC whose completed actions bound narrative durations.
 * @returns {object} Combat interval, wall-clock milliseconds and persisted action revision.
 */
export function weaponEffectContext(actor) {
  const combat = globalThis.game?.combat;
  return { appliedAt: Date.now(), combatId: combat?.id ?? null, combatRound: combat?.round ?? null,
    actionRevision: actor?.flags?.cypher?.weaponActionRevision ?? 0 };
}

/**
 * Persist a GM's explicit second round for a CRD "a round or two" effect.
 * Reject players, expired/missing effects, and repeated extensions before writes.
 * The supplied Actor remains the owner, including an unlinked token's Actor.
 * Local overlap protection is not a lock across different GM clients.
 * @param {Actor} actor Affected NPC.
 * @param {string} effectId Persisted effect ID, not an Item ID.
 * @returns {Promise<boolean>} True only after extending the stored effect.
 */
export async function extendWeaponEffect(actor, effectId) {
  if (actor?.type !== "npc" || actor.isOwner === false || !globalThis.game?.user?.isGM) return false;
  return (await runActorAction(actor, "weaponEffectAdjudication", async () => {
    const effects = getActiveWeaponEffects(actor);
    const effect = effects.find(effect => effect.id === effectId);
    if (!effect || effect.duration !== "a round or two" || weaponEffectRounds(effect) !== 1
      || !weaponEffectIsActive(effect, globalThis.game?.combat)) return false;
    await writeEffects(actor, effects.map(candidate => candidate === effect
      ? { ...candidate, roundCount: 2, narrativeRoundsRemaining: 2 } : candidate));
    return true;
  })) ?? false;
}

function readEffects(actor) {
  return actor?.flags?.cypher?.activeWeaponEffects ?? [];
}

async function writeEffects(actor, effects) {
  if (typeof actor.setFlag === "function") {
    await actor.setFlag("cypher", "activeWeaponEffects", effects);
    return;
  }

  await actor.update({ [EFFECTS_FLAG]: effects });
}

/**
 * Return target effects that have not passed their declared duration.
 *
 * @param {Actor} actor NPC receiving weapon effects.
 * @returns {object[]} Active effects with repeated Stunstick hindrance resolved.
 */
export function getActiveWeaponEffects(actor) {
  const effects = readEffects(actor);
  const combat = globalThis.game?.combat;

  return resolveWeaponEffectStacking(effects.filter(effect => weaponEffectIsActive(effect, combat)), combat);
}

/**
 * Prepare read-only NPC sheet data without updating flags during rendering.
 * @param {Actor} actor Affected NPC, including a synthetic token Actor.
 * @returns {object[]} Active effects with total round duration and GM extension eligibility.
 */
export function getWeaponEffectDisplayData(actor) {
  return getActiveWeaponEffects(actor).map(effect => ({
    ...effect,
    rounds: weaponEffectRounds(effect),
    canExtend: Boolean(globalThis.game?.user?.isGM) && actor.isOwner !== false
      && effect.duration === "a round or two" && weaponEffectRounds(effect) === 1
  }));
}

/**
 * Persist matching structured effects after a successful weapon attack.
 *
 * Repeated Stunstick hits keep two steps and the latest active deadline. New
 * writes discard expired intervals and consolidate compatible old flags.
 *
 * @param {Actor} target NPC target.
 * @param {Array<object>} effects Effects already filtered for target level.
 * @param {object} [source={}] Weapon/source identity.
 * @param {object} [context] Original interval when reconciling a rerolled attack.
 * @returns {Promise<number>} Number of effects accepted, including refreshed effects.
 */
export async function applyWeaponTargetEffects(target, effects = [], source = {}, context = weaponEffectContext(target)) {
  if (target?.type !== "npc" || !Array.isArray(effects) || !effects.length) {
    return 0;
  }

  const existing = getActiveWeaponEffects(target);
  const combat = globalThis.game?.combat;
  const applied = effects
    .filter(effect => effect && typeof effect.effect === "string")
    .map((effect, index) => ({
      ...effect,
      id: `${source.itemId ?? "weapon"}-${Date.now()}-${index}`,
      sourceItemId: source.itemId ?? null,
      sourceItemName: source.itemName ?? "",
      appliedAt: context.appliedAt,
      combatId: context.combatId,
      combatRound: context.combatRound,
      ...(effect.duration === "a round or two" ? { roundCount: 1, narrativeRoundsRemaining: 1 } : {})
    }))
    .filter(effect => weaponEffectIsActive(effect, combat)
      && (!(effect.duration === "next action" || weaponEffectRounds(effect) !== null && !effect.combatId)
        || context.actionRevision === (target.flags?.cypher?.weaponActionRevision ?? 0)));

  if (!applied.length) return 0;

  await writeEffects(target, resolveWeaponEffectStacking([...existing, ...applied], combat));
  return applied.length;
}

/**
 * Consume next-action effects and narrative-round counters after an NPC action.
 *
 * @param {Actor} actor NPC whose action has resolved.
 * @returns {Promise<number>} Number of effects removed.
 */
export async function expireWeaponEffectsAfterAction(actor) {
  if (actor?.type !== "npc") return 0;

  const existing = readEffects(actor);
  const inNarrativeRound = !globalThis.game?.combat;
  const remaining = getActiveWeaponEffects(actor)
    .map(effect => consumeWeaponEffectAction(effect, !inNarrativeRound)).filter(Boolean);
  const removed = existing.length - remaining.length;
  // Even an unaffected NPC action closes the interval for an older missed
  // attack's next-action effect. Persist clock and effects in the same update.
  await actor.update({ [EFFECTS_FLAG]: remaining,
    "flags.cypher.weaponActionRevision": (actor.flags?.cypher?.weaponActionRevision ?? 0) + 1 });
  return removed;
}

/**
 * Remove expired intervals and consolidate active Stunstick overlaps.
 *
 * @param {Actor} actor NPC whose effects are being checked.
 * @returns {Promise<number>} Number of effects removed.
 */
export async function expireWeaponEffectsOutsideCurrentRound(actor) {
  if (actor?.type !== "npc") return 0;

  const existing = readEffects(actor);
  const remaining = getActiveWeaponEffects(actor);
  const removed = existing.length - remaining.length;
  if (removed) await writeEffects(actor, remaining);
  return removed;
}
