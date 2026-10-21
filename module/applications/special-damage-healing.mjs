/** Conventional healing limits for explicitly declared treatment-resistant disease damage. */
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";

/** Read protected wounds and Pool loss without creating a second current-damage track. */
export function specialDamageLimits(actor) {
  const wounds = { minor: 0, moderate: 0, major: 0 }, pools = { might: 0, speed: 0, intellect: 0 };
  for (const effect of getGeneralEffects(actor).filter(effect => effect.kind === "restrictedDamage")) {
    for (const key of Object.keys(wounds)) wounds[key] += effect.wounds?.[key] ?? 0;
    if (effect.pool) pools[effect.pool.stat] += effect.pool.amount;
  }
  return { wounds, pools };
}

/** Reject restoration of protected damage while allowing resource spending and new injuries. */
export function conventionalHealingAllowed(actor, patch) {
  const limits = specialDamageLimits(actor);
  const value = path => Object.hasOwn(patch, path) ? Number(patch[path])
    : path.split(".").reduce((entry, key) => entry?.[key], patch);
  for (const severity of Object.keys(limits.wounds)) {
    const next = value(`system.wounds.${severity}.current`);
    if (Number.isFinite(next) && next < Math.min(actor.system.wounds?.[severity]?.current ?? 0, limits.wounds[severity])) return false;
  }
  for (const stat of Object.keys(limits.pools)) {
    if (!limits.pools[stat]) continue;
    const next = value(`system.stats.${stat}.pool.value`), pool = actor.system.stats?.[stat]?.pool;
    const items = actor.items?.contents ?? (Array.isArray(actor.items) ? actor.items : Array.from(actor.items?.values?.() ?? []));
    const modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, items, actor.system);
    const max = value(`system.stats.${stat}.pool.max`) ?? pool?.max;
    if (pool && Number.isFinite(next) && next > pool.value && next > max + (modifiers.poolMax[stat] ?? 0) - limits.pools[stat]) return false;
  }
  return true;
}

/**
 * preUpdateActor safeguard for direct sheet/macro restoration. A known reroll
 * correction removes its own restriction and damage, rather than healing it.
 * Explicitly completing specialist treatment removes the restriction first.
 */
export function enforceSpecialDamageHealing(actor, changes, options = {}) {
  if (actor.type !== "pc" || options.cypherDefenseCorrection === true) return;
  if (!conventionalHealingAllowed(actor, changes)) {
    ui.notifications.warn(game.i18n.localize("CYPHER.General.SpecialistRequired"));
    return false;
  }
}
