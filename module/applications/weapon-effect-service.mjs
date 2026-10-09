/**
 * Persist and resolve source-backed weapon effects on NPC targets.
 *
 * Only explicit structured effects and their declared durations are stored.
 * Combat-round effects are scoped to the combat and round in which they apply.
 */

const EFFECTS_FLAG = "flags.cypherFoundry.activeWeaponEffects";

function readEffects(actor) {
  return actor?.flags?.cypherFoundry?.activeWeaponEffects ?? [];
}

/**
 * Return target effects that have not passed their declared duration.
 *
 * @param {Actor} actor NPC receiving weapon effects.
 * @returns {object[]} Active effects in application order.
 */
export function getActiveWeaponEffects(actor) {
  const effects = readEffects(actor);
  const combat = globalThis.game?.combat;

  return effects.filter(effect => {
    if (effect.duration === "one round") {
      if (!combat) return effect.combatId === null;
      return effect.combatId === combat.id && effect.combatRound === combat.round;
    }
    return true;
  });
}

/**
 * Persist matching structured effects after a successful weapon attack.
 *
 * @param {Actor} target NPC target.
 * @param {Array<object>} effects Effects already filtered for target level.
 * @param {object} [source={}] Weapon/source identity.
 * @returns {Promise<number>} Number of effects added.
 */
export async function applyWeaponTargetEffects(target, effects = [], source = {}) {
  if (target?.type !== "npc" || !Array.isArray(effects) || !effects.length) {
    return 0;
  }

  const existing = readEffects(target);
  const combat = globalThis.game?.combat;
  const applied = effects
    .filter(effect => effect && typeof effect.effect === "string")
    .map((effect, index) => ({
      ...effect,
      id: `${source.itemId ?? "weapon"}-${Date.now()}-${index}`,
      sourceItemId: source.itemId ?? null,
      sourceItemName: source.itemName ?? "",
      appliedAt: Date.now(),
      combatId: combat?.id ?? null,
      combatRound: combat?.round ?? null
    }));

  if (!applied.length) return 0;

  await target.update({
    [EFFECTS_FLAG]: [...existing, ...applied]
  });
  return applied.length;
}

/**
 * Consume next-action effects after the affected NPC has attempted an action.
 *
 * @param {Actor} actor NPC whose action has resolved.
 * @returns {Promise<number>} Number of effects removed.
 */
export async function expireWeaponEffectsAfterAction(actor) {
  if (actor?.type !== "npc") return 0;

  const existing = readEffects(actor);
  const inNarrativeRound = !globalThis.game?.combat;
  const remaining = existing.filter(effect =>
    effect.duration !== "next action"
    && !(inNarrativeRound
      && effect.duration === "one round"
      && effect.combatId === null)
  );
  const removed = existing.length - remaining.length;
  if (removed) await actor.update({ [EFFECTS_FLAG]: remaining });
  return removed;
}

/**
 * Clear effects whose combat round has ended.
 *
 * @param {Actor} actor NPC whose effects are being checked.
 * @returns {Promise<number>} Number of effects removed.
 */
export async function expireWeaponEffectsOutsideCurrentRound(actor) {
  if (actor?.type !== "npc") return 0;

  const existing = readEffects(actor);
  const combat = globalThis.game?.combat;
  const remaining = existing.filter(effect => {
    if (effect.duration !== "one round") return true;
    if (!combat) return effect.combatId === null;
    return effect.combatId === combat.id
      && effect.combatRound === combat.round;
  });
  const removed = existing.length - remaining.length;
  if (removed) await actor.update({ [EFFECTS_FLAG]: remaining });
  return removed;
}
