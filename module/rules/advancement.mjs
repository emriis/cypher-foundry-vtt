import { CYPHER } from "../config.mjs";

/**
 * Advance a skill by one progression step.
 *
 * @param {string} level Current skill level.
 * @returns {string} Next skill level.
 */
export function advanceSkillLevel(level) {
  const order = ["inability", "practiced", "trained", "specialized", "expert"];
  if (level === "inability") return "trained";

  const index = order.indexOf(level);
  return order[Math.min(order.length - 1, index + 1)];
}

/**
 * Compute the mechanical effects of an advancement slot.
 *
 * The returned values are persistence updates or instructions that the Actor
 * document can apply. No Foundry APIs or presentation code are used here.
 *
 * @param {object} slot Advancement slot.
 * @param {object} extra User-selected advancement options.
 * @param {object} system Current actor system data.
 * @returns {{updates: object, skillAction: object|null}}
 */
export function computeAdvancementEffects(slot, extra = {}, system = {}) {
  const updates = {};
  let skillAction = null;

  switch (slot?.type) {
    case "capabilities": {
      const distribution = extra.distribution ?? {};
      for (const stat of CYPHER.stats) {
        const add = Number(distribution[stat]) || 0;
        if (add) {
          updates[`system.stats.${stat}.pool.max`] =
            system.stats[stat].pool.max + add;
          updates[`system.stats.${stat}.pool.value`] =
            system.stats[stat].pool.value + add;
        }
      }
      break;
    }

    case "perfection": {
      const stat = extra.stat || "might";
      updates[`system.stats.${stat}.edge`] =
        system.stats[stat].edge + 1;
      break;
    }

    case "effort":
      updates["system.effort"] = Math.min(6, system.effort + 1);
      break;

    case "skill":
      if (extra.skillId) {
        skillAction = {
          type: "advance",
          skillId: extra.skillId
        };
      } else if (extra.newSkillName?.trim()) {
        skillAction = {
          type: "create",
          name: extra.newSkillName.trim()
        };
      }
      break;

    case "other":
      if (slot.otherType === "recovery") {
        updates["system.recoveryBonus"] = (system.recoveryBonus ?? 0) + 2;
      } else if (slot.otherType === "armor") {
        updates["system.freeArmorCategories"] = [...CYPHER.armorCategoryIds];
        updates["system.canFreelyUseAllArmor"] = true;
      } else if (slot.otherType === "weapons") {
        updates["system.freeWeaponCategories"] = [...CYPHER.weaponCategories];
        updates["system.canFreelyUseAllWeapons"] = true;
      }
      break;
  }

  return { updates, skillAction };
}

/**
 * Create the fresh advancement slots used when a tier is reached.
 *
 * @returns {object[]} Four unbought advancement slots.
 */
export function createFreshAdvancementSlots() {
  return Array.from({ length: 4 }, () => ({
    type: "",
    otherType: "",
    bought: false
  }));
}

/**
 * Compute the tier and reset-slot state after completing four advancements.
 *
 * @param {number} tier Current character tier.
 * @returns {{newTier: number, freshSlots: object[]}}
 */
export function computeTierAdvancement(tier) {
  return {
    newTier: Math.min(6, tier + 1),
    freshSlots: createFreshAdvancementSlots()
  };
}
