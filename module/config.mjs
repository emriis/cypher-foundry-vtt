/**
 * Centralized constants and rule configuration for the Cypher system.
 *
 * Keep game-rule values in this module rather than duplicating literals across
 * documents, data models, and sheets. Consumers should import CYPHER instead
 * of redefining these values locally.
 */
export const CYPHER = {};

/** Core Cypher stat identifiers. */
CYPHER.stats = ["might", "speed", "intellect"];

/**
 * Skill training levels and their step modifiers.
 *
 * Inability hinders a task by one step; untrained has no modifier; trained,
 * specialized, and expert ease a task by one, two, and three steps respectively.
 */
CYPHER.skillLevels = {
  inability: -1,
  none: 0,
  trained: 1,
  specialized: 2,
  expert: 3
};

/** Wound severities in ascending order. */
CYPHER.woundSeverities = ["minor", "moderate", "major"];

/** Default wound capacity for a core character before Type-specific modifiers. */
CYPHER.defaultWoundMax = { minor: 3, moderate: 3, major: 3 };

/**
 * Converts overflow damage from an empty Pool into wound severity.
 * The first matching maximum defines the resulting severity.
 */
CYPHER.poolDamageToWound = [
  { max: 4, severity: "minor" },
  { max: 8, severity: "moderate" },
  { max: Infinity, severity: "major" }
];

/** Supported character tiers. */
CYPHER.tiers = [1, 2, 3, 4, 5, 6];

/** Supported item data-model types. */
CYPHER.itemTypes = [
  "skill",
  "ability",
  "cypher",
  "artifact",
  "oddity",
  "equipment",
  "attack",
  "armor",
  "shield"
];

/** Default wound capacity for shields. */
CYPHER.defaultShieldWoundMax = { minor: 3, moderate: 2, major: 1 };

/** Supported cypher categories. */
CYPHER.cypherTypes = ["subtle", "manifest"];

/**
 * Effort cost by level before Edge is applied.
 * The first level costs three Pool points; each additional level costs two.
 */
CYPHER.effortCostFirstLevel = 3;
CYPHER.effortCostAdditionalLevel = 2;

/** Recovery intervals supported by the system. */
CYPHER.recoveryIntervals = ["action", "tenMinutes", "hour", "tenHours"];

/**
 * Supported game genres. The custom genre exposes all character-creation
 * fields for fully custom character definitions.
 */
CYPHER.genres = ["none", "realWorld", "fantasy", "sciFi", "superhero", "custom"];

/** Field types available to the fully customizable Custom Fields section. */
CYPHER.customFieldTypes = ["text", "number", "checkbox"];

/** Depletion dice available to artifacts and charge-based equipment. */
CYPHER.depletionDice = ["d6", "d8", "d10", "d12", "d20"];
CYPHER.depletionDieMax = { d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

/** Power Shift categories supported by superhero characters. */
CYPHER.powerShiftCategories = [
  "accuracy", "dexterity", "flight", "healing", "increasedRange",
  "intelligence", "power", "prodigy", "resilience", "savant", "singleAttack", "strength"
];

/** Rally cost for a major wound in superhero games. */
CYPHER.rallyCostMajorSuperhero = 10;

/** Maximum task difficulty for standard and superhero games. */
CYPHER.maxDifficulty = { standard: 10, superhero: 15 };

/** Experience Point costs for player-facing special actions. */
CYPHER.xpCosts = {
  reroll: 1,
  playerIntrusion: 1,
  luckyShot: 1,
  advancementSlot: 4
};

/**
 * Standard advancement slots available at each tier. "other" replaces one
 * standard slot when a character selects an alternate advancement.
 */
CYPHER.advancementTypes = ["capabilities", "perfection", "effort", "skill", "other"];
CYPHER.otherAdvancementTypes = ["recovery", "focus", "armor", "weapons", "genre"];

/** Base damage by weapon category. */
CYPHER.weaponDamage = { light: 2, medium: 4, heavy: 6 };

/**
 * Armor categories and their defensive task modifiers.
 * Armor eases Block and hinders Dodge by the configured number of steps.
 */
CYPHER.armorCategories = {
  light: { block: 1, dodge: 1 },
  medium: { block: 2, dodge: 2 },
  heavy: { block: 3, dodge: 3 }
};

/** Rally cost in Might points for removing minor and moderate wounds. */
CYPHER.rallyCost = { minor: 2, moderate: 5 };

/** Icons used by custom status effects. */
CYPHER.statusIcons = {
  hindered: "icons/svg/downgrade.svg",
  dead: "icons/svg/skull.svg"
};
