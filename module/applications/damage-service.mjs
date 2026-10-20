import { CYPHER } from "../config.mjs";
import { shieldSurvivesMajor, shieldOwnerItems } from "../rules/shield-abilities.mjs";
import { resolveAbilityWoundTrack, resolveShieldWoundTrack } from "../rules/ability-modifiers.mjs";
import {
  computeWoundIncrease,
  canShieldAbsorbWound,
  convertDamageToWound,
  reduceWoundSeverity,
  resolveNpcDamage,
  resolvePoolDamage,
  resolveShieldWoundSeverity
} from "../rules/wounds.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { runActorAction } from "./action-guard.mjs";

/**
 * Reduce a wound by one severity step.
 *
 * @param {string} severity Current wound severity.
 * @returns {string|null} The reduced severity, or null when the wound disappears.
 */
export function reduceWound(severity) {
  return reduceWoundSeverity(severity);
}

/**
 * Make a shield absorb a complete wound, including cascading overflow.
 *
 * @param {Actor} actor Character protected by the shield.
 * @param {object} shieldItem Equipped shield receiving the wound.
 * @param {string} severity Incoming wound severity.
 * @param {object|null} [actionContext=null] Explicit context of a parent task.
 * @returns {Promise<boolean>} Whether a wound was absorbed; rejection writes nothing.
 */
export async function shieldAbsorbWound(actor, shieldItem, severity, actionContext = null) {
  return Boolean(await runActorAction(actor, "shield", async () => {
    // The actual embedded Item must belong to this owner (including synthetic
    // Actors). Recheck every wound so destruction cannot absorb later hits.
    if (actor.type !== "pc" || actor.isOwner === false || shieldItem?.isOwner === false
      || !CYPHER.woundSeverities.includes(severity) || !canShieldAbsorbWound(shieldItem)
      || actor.items?.get?.(shieldItem.id) !== shieldItem) return false;
    return absorbShieldWound(actor, shieldItem, severity);
  }, actionContext));
}

/** Persist one validated shield wound, then announce destruction after success. */
async function absorbShieldWound(actor, shieldItem, severity) {
  const items = actor.items;
  const wounds = resolveShieldWoundTrack(shieldItem.system.wounds, actor.system?.activeAbilityEffects,
    items?.contents ?? (Array.isArray(items) ? items : Array.from(items?.values?.() ?? [])), actor.system);
  const target = resolveShieldWoundSeverity(severity, wounds);
  const newCurrent = wounds[target].current + 1;
  const unyielding = shieldSurvivesMajor(shieldItem, shieldOwnerItems(shieldItem));

  await shieldItem.update({
    [`system.wounds.${target}.current`]: Math.min(
      newCurrent,
      target === "major" ? 1 : wounds[target].max
    ),
    ...(target === "major" && !unyielding ? { "system.equipped": false } : {})
  });

  if (target === "major" && unyielding) {
    await actor.update({ "flags.cypher.shieldTurnLossPending": true });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${game.i18n.localize("CYPHER.ShieldAbility.TurnLossPending")}</p>` });
  } else if (target === "major") {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cypher-roll-card"><h3>${
        game.i18n.localize("CYPHER.Shield.Broken")
      }</h3><p>${
        game.i18n.format("CYPHER.Shield.BrokenNote", {
          name: foundry.utils.escapeHTML(shieldItem.name)
        })
      }</p></div>`
    });
  }
  return true;
}

/**
 * Add a wound to a PC and synchronize its token statuses.
 *
 * @param {Actor} actor Character receiving the wound.
 * @param {string} severity Wound severity to add.
 * @returns {Promise<void>} Completes after the actor has been updated.
 */
export async function addWound(actor, severity) {
  if (actor.type !== "pc" || actor.isOwner === false) return;

  const items = actor.items;
  const wounds = resolveAbilityWoundTrack(actor.system.wounds, actor.system.activeAbilityEffects,
    items?.contents ?? (Array.isArray(items) ? items : Array.from(items?.values?.() ?? [])), actor.system);
  const { target, current } = computeWoundIncrease(severity, wounds);

  await actor.update({
    [`system.wounds.${target}.current`]: current
  });

  if (target === "major" && current >= wounds.major.max) {
    ui.notifications.error(
      game.i18n.format("CYPHER.Warning.CharacterDied", {
        name: actor.name
      })
    );
  }

  await syncWoundStatusEffects(actor);
}

/**
 * Apply damage to either a PC's Pool/wound track or an NPC's Health.
 *
 * @param {Actor} actor Actor receiving damage.
 * @param {number} amount Raw damage amount.
 * @param {object} [options={}] Damage options.
 * @param {string|null} [options.severity=null] Explicit wound severity.
 * @param {string|null} [options.stat=null] PC Pool to damage directly.
 * @param {boolean} [options.ignoreArmor=false] Ignore all NPC Armor (legacy option).
 * @param {number} [options.armorBypass=0] Points of NPC Armor ignored.
 * @returns {Promise<number|undefined>} NPC damage actually dealt, when applicable.
 */
export async function applyDamage(
  actor,
  amount,
  { severity = null, stat = null, ignoreArmor = false, armorBypass = 0 } = {}
) {
  if (actor.type !== "pc") {
    return applyNpcDamage(actor, amount, { ignoreArmor, armorBypass });
  }

  if (stat) {
    const resolved = resolveStat(actor.system, stat);
    if (!resolved) return;

    const pool = resolved.data.pool;
    const resolution = resolvePoolDamage(amount, pool.value);
    const newValue = pool.value - resolution.poolDamage;

    await actor.update({
      [`${resolved.path}.pool.value`]: newValue
    });

    if (resolution.overflow > 0) {
      const woundSeverity = severity ?? resolution.woundSeverity;
      await addWound(actor, woundSeverity);
    }
    return resolution.poolDamage;
  }

  const woundSeverity = severity ?? convertDamageToWound(amount);
  await addWound(actor, woundSeverity);
}

/**
 * Apply NPC damage after armor mitigation.
 *
 * @param {Actor} actor NPC receiving damage.
 * @param {number} amount Raw damage amount.
 * @param {object} [options={}] Damage options.
 * @param {boolean} [options.ignoreArmor=false] Whether to bypass all Armor.
 * @param {number} [options.armorBypass=0] Points of Armor ignored.
 * @returns {Promise<number|undefined>} Damage actually applied.
 */
export async function applyNpcDamage(
  actor,
  amount,
  { ignoreArmor = false, armorBypass = 0 } = {}
) {
  const armor = actor.system.armor ?? 0;
  const finalDamage = resolveNpcDamage(
    amount,
    armor,
    ignoreArmor ? Number.MAX_SAFE_INTEGER : armorBypass
  );
  const health = actor.system.health;

  if (!health) return;

  const newValue = Math.max(0, health.value - finalDamage);
  await actor.update({ "system.health.value": newValue });
  return finalDamage;
}

/**
 * Synchronize token status effects with the actor's current wound state.
 *
 * @param {Actor} actor Actor whose token statuses should be updated.
 * @returns {Promise<void>} Completes after status effects are synchronized.
 */
export async function syncWoundStatusEffects(actor) {
  if (actor.type !== "pc") return;

  const shouldBeHindered = !!actor.system.hindered;
  const shouldBeDead = !!actor.system.dead;

  if (actor.statuses?.has("hindered") !== shouldBeHindered) {
    await actor.toggleStatusEffect("hindered", { active: shouldBeHindered });
  }
  if (actor.statuses?.has("dead") !== shouldBeDead) {
    await actor.toggleStatusEffect("dead", { active: shouldBeDead });
  }
}

/**
 * Damage the equipped armor's Block bonus.
 *
 * @param {Actor} actor PC whose armor is damaged.
 * @param {number} steps Number of damage steps.
 * @returns {Promise<void>} Completes after the armor item is updated.
 */
export async function damageArmor(actor, steps = 1) {
  if (actor.type !== "pc") return;

  const itemId = actor.system.armor.itemId;
  if (!itemId) {
    ui.notifications.warn(
      game.i18n.localize("CYPHER.Armor.NoArmorEquipped")
    );
    return;
  }

  const item = actor.items.get(itemId);
  if (!item) return;

  const baseEase = actor.system.armor.baseBlockEase ?? 0;
  if (baseEase <= 0) {
    ui.notifications.info(
      game.i18n.localize("CYPHER.Armor.NoBlockBonusToDamage")
    );
    return;
  }

  const newDamage = Math.min(
    baseEase,
    (item.system.blockEaseDamage ?? 0) + steps
  );
  await item.update({ "system.blockEaseDamage": newDamage });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cypher-roll-card"><h3>${
      game.i18n.localize("CYPHER.Armor.Damaged")
    }</h3><p>${
      game.i18n.format("CYPHER.Armor.DamagedNote", {
        name: actor.name
      })
    }</p></div>`
  });
}

/**
 * Repair the equipped armor by clearing accumulated Block damage.
 *
 * @param {Actor} actor PC whose armor is repaired.
 * @returns {Promise<void>} Completes after the armor item is updated.
 */
export async function repairArmor(actor) {
  if (actor.type !== "pc") return;

  const itemId = actor.system.armor.itemId;
  if (!itemId) return;

  const item = actor.items.get(itemId);
  if (!item) return;

  await item.update({ "system.blockEaseDamage": 0 });
}
