import { CYPHER } from "../config.mjs";

const LIGHT_WEAPONS = ["light"];
const LIGHT_MEDIUM_WEAPONS = ["light", "medium"];
const ALL_WEAPONS = [...CYPHER.weaponCategories];
const LIGHT_ARMOR = ["light"];
const LIGHT_MEDIUM_ARMOR = ["light", "medium"];
const ALL_ARMOR = [...CYPHER.armorCategoryIds];

// Legacy Type booleans meant "has some free-use benefit", not "all categories".
const LEGACY_TYPE_FREE_USE = {
  fantasy: {
    "Archer": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Axe Fighter": { weapons: LIGHT_WEAPONS, armor: ALL_ARMOR, families: ["axes"] },
    "Barbarian": { weapons: ALL_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Bard": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Burglar": { weapons: LIGHT_WEAPONS, armor: LIGHT_ARMOR },
    "Cleric": { weapons: LIGHT_MEDIUM_WEAPONS, armor: ALL_ARMOR },
    "Druid": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Fighter": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Knife Fighter": { weapons: LIGHT_WEAPONS, armor: LIGHT_ARMOR, families: ["knives"] },
    "Mage": { weapons: LIGHT_WEAPONS, armor: [] },
    "Monk": { weapons: LIGHT_WEAPONS, armor: [] },
    "Necromancer": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Noble Warrior": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Paladin": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Priest": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Ranger": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Rogue": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Sorcerer": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Swashbuckler": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Sword Fighter": { weapons: LIGHT_WEAPONS, armor: ALL_ARMOR, families: ["swords"] },
    "Thief": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Two-Weapon Fighter": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Warrior": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Witch": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Wizard": { weapons: LIGHT_MEDIUM_WEAPONS, armor: [] }
  },
  sciFi: {
    "Android": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Dealer": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Diplomat": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Engineer": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Heavy": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Medic": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Noble": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Operative": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Pilot": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Psion": { weapons: LIGHT_MEDIUM_WEAPONS, armor: [] },
    "Scoundrel": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Soldier": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Starpilot": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_MEDIUM_ARMOR },
    "Tech": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Tender": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Trader": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR },
    "Survivor": { weapons: LIGHT_MEDIUM_WEAPONS, armor: LIGHT_ARMOR }
  },
  superhero: {
    "Crimefighter (Rank 1)": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Enhanced Hero (Rank 2)": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Living God (Rank 5)": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Powerhouse (Rank 4)": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Powerstar (Rank 2)": { weapons: LIGHT_WEAPONS, armor: ALL_ARMOR },
    "Superhuman (Rank 3)": { weapons: ALL_WEAPONS, armor: ALL_ARMOR },
    "Vigilante (Rank 1)": { weapons: ALL_WEAPONS, armor: ALL_ARMOR }
  }
};

const LEGACY_TYPE_NAME_ALIASES = {
  fantasy: {
    "Archer·ère": "Archer",
    "Combattant·e à la hache": "Axe Fighter",
    "Barbare": "Barbarian",
    "Barde": "Bard",
    "Cambrioleur·euse": "Burglar",
    "Clerc": "Cleric",
    "Druide": "Druid",
    "Combattant": "Fighter",
    "Combattant·e au Couteau": "Knife Fighter",
    "Moine": "Monk",
    "Nécromancien": "Necromancer",
    "Noble guerrier·ère": "Noble Warrior",
    "Prêtre·esse": "Priest",
    "Rôdeur": "Ranger",
    "Roublard": "Rogue",
    "Ensorceleur·euse": "Sorcerer",
    "Bretteur·euse": "Swashbuckler",
    "Combattant·e à l’épée": "Sword Fighter",
    "Voleur·euse": "Thief",
    "Combattant·e à deux armes": "Two-Weapon Fighter",
    "Guerrier·ère": "Warrior",
    "Sorcier·ère": "Witch",
    "Magicien·ne": "Wizard"
  },
  sciFi: {
    "Androïde": "Android",
    "Magouilleur·euse": "Dealer",
    "Diplomate": "Diplomat",
    "Ingénieur·e": "Engineer",
    "Bourrin·e": "Heavy",
    "Toubib": "Medic",
    "Opérateur·rice": "Operative",
    "Pilote": "Pilot",
    "Psion·ne": "Psion",
    "Fripouille": "Scoundrel",
    "Soldat·e": "Soldier",
    "Pilote spatial": "Starpilot",
    "Soigneur": "Tender",
    "Marchand·e": "Trader",
    "Survivant·e": "Survivor"
  },
  superhero: {
    "Justicier·ère": "Crimefighter (Rank 1)",
    "Héros·ïne Augmenté·e": "Enhanced Hero (Rank 2)",
    "Dieu Vivant": "Living God (Rank 5)",
    "Colosse": "Powerhouse (Rank 4)",
    "Astropuissance": "Powerstar (Rank 2)",
    "Surhumain·e": "Superhuman (Rank 3)",
    "Vengeur·euse": "Vigilante (Rank 1)"
  }
};

/**
 * Build the schema changes for the legacy free-use migration without touching
 * a Foundry document. Keeping this transformation pure makes it easy to test.
 *
 * @param {object} actor Actor-like object containing type and system data.
 * @returns {object} Update object, or an empty object when no migration applies.
 */
export function buildLegacyFreeUseUpdates(actor) {
  if (actor.type !== "pc") return {};

  const system = actor.system;
  const typeName = LEGACY_TYPE_NAME_ALIASES[system.genre]?.[system.type] ?? system.type;
  const typeGrant = system.type
    ? LEGACY_TYPE_FREE_USE[system.genre]?.[typeName]
    : null;
  const slots = system.advancementSlots ?? [];
  const boughtAllWeaponAdvancement = slots.some(
    slot => slot.bought && slot.type === "other" && slot.otherType === "weapons"
  );
  const boughtAllArmorAdvancement = slots.some(
    slot => slot.bought && slot.type === "other" && slot.otherType === "armor"
  );
  const oldCanUseAllWeapons = Boolean(system.canFreelyUseAllWeapons);
  const oldCanUseAllArmor = Boolean(system.canFreelyUseAllArmor);

  let freeWeaponCategories = [
    ...(system.freeWeaponCategories ?? CYPHER.coreFreeWeaponCategories),
    ...(typeGrant?.weapons ?? [])
  ];
  let freeArmorCategories = [
    ...(system.freeArmorCategories ?? CYPHER.coreFreeArmorCategories),
    ...(typeGrant?.armor ?? [])
  ];
  let freeWeaponFamilies = [
    ...(system.freeWeaponFamilies ?? []),
    ...(typeGrant?.families ?? [])
  ];

  if (boughtAllWeaponAdvancement || (oldCanUseAllWeapons && !typeGrant)) {
    freeWeaponCategories = [...CYPHER.weaponCategories];
  }
  if (boughtAllArmorAdvancement || (oldCanUseAllArmor && !typeGrant)) {
    freeArmorCategories = [...CYPHER.armorCategoryIds];
  }

  return {
    "flags.cypher.freeUseMigrationBackup": {
      canFreelyUseAllWeapons: system.canFreelyUseAllWeapons ?? false,
      canFreelyUseAllArmor: system.canFreelyUseAllArmor ?? false,
      freeWeaponCategories: system.freeWeaponCategories ?? null,
      freeArmorCategories: system.freeArmorCategories ?? null,
      freeWeaponFamilies: system.freeWeaponFamilies ?? null
    },
    "system.freeWeaponCategories": [...new Set(freeWeaponCategories)],
    "system.freeArmorCategories": [...new Set(freeArmorCategories)],
    "system.freeWeaponFamilies": [...new Set(freeWeaponFamilies)],
    "system.freeWeaponSkillCategories": system.freeWeaponSkillCategories ?? [],
    "system.canFreelyUseAllWeapons": false,
    "system.canFreelyUseAllArmor": false
  };
}

/**
 * Apply the actor schema migrations needed by the current system version.
 *
 * @param {Actor} actor Actor document to migrate.
 * @param {string} targetVersion Schema version being applied.
 * @returns {Promise<void>}
 */
export async function migrateActor(actor, targetVersion) {
  const actorSchemaVersion = actor.getFlag?.("cypher", "schemaVersion") ?? "0.0.0";
  const updates = {};

  if (
    foundry.utils.isNewerVersion("0.1.7", actorSchemaVersion) &&
    actor.type === "pc"
  ) {
    Object.assign(updates, buildLegacyFreeUseUpdates(actor));
  }

  if (Object.keys(updates).length) {
    updates["flags.cypher.schemaVersion"] = targetVersion;
    await actor.update(updates);
  } else {
    await actor.setFlag("cypher", "schemaVersion", targetVersion);
  }
}
