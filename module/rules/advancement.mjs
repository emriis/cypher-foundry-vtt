import { CYPHER } from "../config.mjs";

/**
 * Apply ordinary advancement training: cancel inability or advance up to specialization.
 *
 * @param {string} level Current skill level.
 * @returns {string} Next skill level.
 */
export function advanceSkillLevel(level) {
  const order = ["inability", "practiced", "trained", "specialized", "expert"];
  if (level === "inability") return "practiced";
  if (level === "expert") return "expert";

  const index = order.indexOf(level);
  return order[Math.min(order.indexOf("specialized"), index + 1)];
}


/**
 * Validate player-selected options for an advancement slot.
 *
 * @param {object} slot Advancement slot.
 * @param {object} extra User-selected advancement options.
 * @returns {string|null} Validation error key, or null when valid.
 */
export function validateAdvancementChoices(slot, extra = {}) {
  if (slot?.type === "capabilities") {
    const distribution = extra.distribution ?? {};
    const values = CYPHER.stats.map(stat => distribution[stat] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    if (Object.keys(distribution).some(stat => !CYPHER.stats.includes(stat))
      || !values.every(value => Number.isSafeInteger(value) && value >= 0) || total !== 4) return "CYPHER.Warning.CapabilitiesMustSumFour";
  }
  return null;
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
    newTier: tier + 1,
    freshSlots: createFreshAdvancementSlots()
  };
}

/** CRD Gaining Resource Points: the purchasing tier determines the reward. */
export function advancementResourcePoints(tier) { return tier >= 5 ? 3 : tier >= 3 ? 2 : 1; }

/** CRD Skill advancement: incapacity cancellation, ordinary specialization and combat gates. */
export function canPurchaseSkillTraining(skill, tier) {
  if (!Number.isSafeInteger(tier) || tier < 1) return false;
  const level = skill.level ?? "practiced";
  if (!["inability", "practiced", "trained"].includes(level)) return false;
  // The authored restriction also covers source Skills such as Gunnery. Custom
  // attack/defense training declares its kind; localized names never decide it.
  const combat = ["attack", "defense"].includes(skill.skillKind) || Boolean(skill.attackCategory);
  if (level === "inability") return tier >= Math.max(combat ? 2 : 1, skill.minimumTier ?? 0);
  const minimum = level === "trained"
    ? Math.max(combat ? 4 : 2, skill.minimumSpecializationTier ?? 0)
    : Math.max(combat ? 2 : 1, skill.minimumTier ?? 0);
  return tier >= minimum;
}

/** Reject duplicate main purchases and multiple replacements using immutable purchase records. */
export function canPurchaseAdvancement(slot, index, system, purchases = []) {
  const tier = system.tier ?? 1;
  if (!Number.isSafeInteger(tier) || tier < 1 || tier >= Number.MAX_SAFE_INTEGER) return false;
  const prior = (system.advancementSlots ?? []).flatMap((entry, position) => {
    const saved = purchases.find(record => record.tier === tier && record.index === position);
    return saved ? [saved] : entry.bought ? [entry] : [];
  });
  if (purchases.some(record => record.tier === tier && record.index === index)) return false;
  if (prior.some(record => record.type === slot.type)) return false;
  if (slot.type === "other") return ["recovery", "focus", "armor", "weapons", "genre"].includes(slot.otherType)
    && (slot.otherType !== "genre" || tier >= 3);
  return ["capabilities", "perfection", "effort", "skill"].includes(slot.type)
    && (slot.type !== "effort" || system.effort < 6);
}
