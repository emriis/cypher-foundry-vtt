import { CYPHER } from "./config.mjs";

/**
 * Schema migration support for persisted Cypher documents.
 *
 * Each actor and item can store the system version it was last migrated against
 * in `flags.cypher.schemaVersion`. Add a `migrateToX` step and invoke it from
 * `migrateWorld` whenever a schema change is incompatible with saved data.
 */

/**
 * Runs pending world migrations.
 *
 * This entry point is intended to be called from the Foundry `ready` hook and
 * performs migrations only when the current user is a Game Master.
 *
 * @returns {Promise<void>}
 */
export async function migrateWorld() {
  if (!game.user.isGM) return;

  await migrateWorldTypeAndFocusAbilities();

  const currentVersion = game.settings.get("cypher", "schemaVersion") ?? "0.0.0";
  const needsVersion = game.system.flags?.needsMigrationVersion;
  const compatibleVersion = game.system.flags?.compatibleMigrationVersion;

  if (!needsVersion || !foundry.utils.isNewerVersion(needsVersion, currentVersion)) return;

  if (compatibleVersion && foundry.utils.isNewerVersion(compatibleVersion, currentVersion)) {
    ui.notifications.error(game.i18n.format("CYPHER.Migration.TooOld", { version: currentVersion }), { permanent: true });
    return;
  }

  ui.notifications.info(game.i18n.format("CYPHER.Migration.Begin", { version: needsVersion }), { permanent: true });

  for (const actor of game.actors) {
    try {
      await migrateActor(actor);
    } catch (err) {
      console.error(`Cypher | Actor migration failed for ${actor.name}`, err);
    }
  }

  // Also migrate actors/items stored in unlocked compendium packs.
  for (const pack of game.packs) {
    if (pack.locked || !["Actor", "Item"].includes(pack.documentName)) continue;
    const documents = await pack.getDocuments();
    for (const doc of documents) {
      try {
        if (doc.documentName === "Actor") await migrateActor(doc);
      } catch (err) {
        console.error(`Cypher | Migration failed for ${doc.name} (${pack.collection})`, err);
      }
    }
  }

  await game.settings.set("cypher", "schemaVersion", needsVersion);
  ui.notifications.info(game.i18n.format("CYPHER.Migration.Complete", { version: needsVersion }), { permanent: true });
}


/**
 * Converts legacy embedded Type/Focus abilities into world-level ability Items.
 *
 * This migration is deliberately limited to world Items. Compendium sources
 * are migrated by the deterministic source-pack build step.
 *
 * @returns {Promise<void>}
 */
async function migrateWorldTypeAndFocusAbilities() {
  const worldItems = [...(game.items ?? [])];
  for (const item of worldItems) {
    if (!["type", "focus"].includes(item.type)) continue;

    const legacyAbilities = item._source?.system?.abilities;
    if (!Array.isArray(legacyAbilities) || !legacyAbilities.some(
      ability => ability && typeof ability === "object"
    )) continue;

    const references = [];
    const ids = new Map();

    for (const ability of legacyAbilities) {
      if (!ability || typeof ability !== "object") continue;

      const action = inferLegacyAbilityAction(ability);
      const created = await Item.create({
        name: ability.name,
        type: "ability",
        img: ability.img ?? "icons/svg/upgrade.svg",
        system: {
          key: ability.id ?? slugLegacyAbilityName(ability.name),
          tier: Number(ability.tier) || 1,
          enabler: Boolean(ability.enabler),
          repeatable: Boolean(ability.repeatable),
          cost: ability.cost ?? { stat: "none", amount: 0, options: [] },
          action,
          freeWeaponCategories: ability.freeWeaponCategories ?? [],
          freeArmorCategories: ability.freeArmorCategories ?? [],
          freeWeaponFamilies: ability.freeWeaponFamilies ?? [],
          freeWeaponSkillCategories: ability.freeWeaponSkillCategories ?? [],
          chooseWeaponAttackCategory: Boolean(ability.chooseWeaponAttackCategory),
          grantedArmorItemCategory: ability.grantedArmorItemCategory ?? "",
          effects: ability.effects ?? [],
          rollTables: ability.rollTables ?? [],
          description: ability.description ?? ""
        },
        flags: {
          cypher: {
            migratedFrom: item.uuid,
            migratedAbilityId: ability.id ?? null
          }
        }
      });

      references.push(created.uuid);
      if (ability.id) ids.set(ability.id, created.id);
    }

    const update = { "system.abilities": references };

    if (item.type === "focus") {
      update["system.flowchart"] = {
        edges: legacyAbilities.flatMap(ability =>
          (ability.prerequisites ?? []).map(prerequisite => ({
            from: ids.get(prerequisite),
            to: ids.get(ability.id)
          }))
        ).filter(edge => edge.from && edge.to)
      };
    }

    await item.update(update);
  }
}

function inferLegacyAbilityAction(ability) {
  if (ability.enabler) return null;
  const text = String(ability.description ?? "").replace(/<[^>]+>/g, " ").trim();
  if (/\\bFirst action\\.\\s*$/i.test(text)) return "firstAction";
  if (/\\bLast action\\.\\s*$/i.test(text)) return "lastAction";
  if (/\\bAction\\.\\s*$/i.test(text)) return "action";
  return null;
}

function slugLegacyAbilityName(name = "ability") {
  return name.normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
 * Migrates one actor and records the current migration version.
 *
 * Keep concrete schema transformations in this function as the data model evolves.
 *
 * @param {Actor} actor Actor document to migrate.
 * @returns {Promise<void>}
 */
async function migrateActor(actor) {
  const updates = {};

  const actorSchemaVersion = actor.getFlag?.("cypher", "schemaVersion") ?? "0.0.0";
  if (foundry.utils.isNewerVersion("0.1.7", actorSchemaVersion) && actor.type === "pc") {
    const system = actor.system;
    const typeName = LEGACY_TYPE_NAME_ALIASES[system.genre]?.[system.type] ?? system.type;
    const typeGrant = system.type
      ? LEGACY_TYPE_FREE_USE[system.genre]?.[typeName]
      : null;
    const slots = system.advancementSlots ?? [];
    const boughtAllWeaponAdvancement = slots.some(slot => slot.bought && slot.type === "other" && slot.otherType === "weapons");
    const boughtAllArmorAdvancement = slots.some(slot => slot.bought && slot.type === "other" && slot.otherType === "armor");
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

    updates["flags.cypher.freeUseMigrationBackup"] = {
      canFreelyUseAllWeapons: system.canFreelyUseAllWeapons ?? false,
      canFreelyUseAllArmor: system.canFreelyUseAllArmor ?? false,
      freeWeaponCategories: system.freeWeaponCategories ?? null,
      freeArmorCategories: system.freeArmorCategories ?? null,
      freeWeaponFamilies: system.freeWeaponFamilies ?? null
    };
    updates["system.freeWeaponCategories"] = [...new Set(freeWeaponCategories)];
    updates["system.freeArmorCategories"] = [...new Set(freeArmorCategories)];
    updates["system.freeWeaponFamilies"] = [...new Set(freeWeaponFamilies)];
    updates["system.freeWeaponSkillCategories"] = system.freeWeaponSkillCategories ?? [];
    updates["system.canFreelyUseAllWeapons"] = false;
    updates["system.canFreelyUseAllArmor"] = false;
  }

  // Example future migration:
  // if (foundry.utils.isNewerVersion("0.2.0", actor.getFlag("cypher", "schemaVersion") ?? "0.0.0")) {
  //   updates["system.someOldField"] = undefined;
  //   updates["system.someNewField"] = actor.system.someOldField ?? defaultValue;
  // }

  if (Object.keys(updates).length) {
    updates["flags.cypher.schemaVersion"] = game.system.flags?.needsMigrationVersion;
    await actor.update(updates);
  } else {
    await actor.setFlag("cypher", "schemaVersion", game.system.flags?.needsMigrationVersion);
  }
}
