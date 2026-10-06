/**
 * Canonical mapping between CRD content families and the repository's Foundry
 * document/data-model types.
 *
 * This module describes structure only. It does not transform or reinterpret
 * CRD rules text.
 */

export const CRD_FOUNDRY_MAPPING = Object.freeze({
  ability: { document: "Item", type: "ability" },
  artifact: { document: "Item", type: "artifact" },
  armor: { document: "Item", type: "armor" },
  cypher: { document: "Item", type: "cypher" },
  descriptor: { document: "Item", type: "descriptor" },
  equipment: { document: "Item", type: "equipment" },
  focus: { document: "Item", type: "focus" },
  skill: { document: "Item", type: "skill" },
  type: { document: "Item", type: "type" },
  weapon: { document: "Item", type: "attack" },
  shield: { document: "Item", type: "shield" },
  creature: { document: "Actor", type: "npc" },
  journal: { document: "JournalEntry", type: null },
  genre: { document: "JournalEntry", type: null }
});

/**
 * Mechanical fields that an extractor should populate when the source provides
 * the corresponding CRD mechanic. These are field paths, not prose templates.
 */
export const CRD_MECHANICAL_FIELDS = Object.freeze({
  ability: [
    "tier", "key", "enabler", "repeatable", "cost", "action", "effects",
    "rollTables", "freeWeaponCategories", "freeArmorCategories",
    "freeWeaponFamilies", "freeWeaponSkillCategories",
    "chooseWeaponAttackCategory", "grantedArmorItemCategory"
  ],
  type: [
    "tier", "genre", "subgenre", "poolBonuses", "edgeChoice", "woundBonuses",
    "freeWeapons", "freeArmor", "freeWeaponCategories", "freeArmorCategories",
    "freeWeaponFamilies", "skillOptions", "abilities", "abilityTiers",
    "statOptions"
  ],
  descriptor: [
    "category", "genres", "grantsSecondDescriptor", "statOptions",
    "statAmount", "skillOptions", "grantedSkills", "benefits"
  ],
  focus: ["abilities", "flowchart"],
  skill: [
    "stat", "level", "attackCategory", "minimumTier",
    "minimumSpecializationTier"
  ],
  weapon: [
    "attackType", "range", "extremeRange", "damage", "stat", "weaponFamily",
    "attackSkillCategory", "priceCategory", "properties", "mechanics"
  ],
  armor: ["category", "freelyUsable", "blockEaseDamage", "priceCategory"],
  shield: ["equipped", "wounds"],
  equipment: [
    "quantity", "level", "priceCategory", "weight", "depletionDie",
    "depletionMin", "depletionMax", "depleted"
  ],
  cypher: [
    "cypherType", "level", "powerLevel", "internal", "identified", "depleted"
  ],
  artifact: [
    "level", "form", "identified", "depletionDie", "depletionMin", "depletionMax",
    "depleted"
  ]
});

/**
 * Return the canonical Foundry representation for a CRD content family.
 *
 * @param {string} contentType CRD content family.
 * @returns {{document: string, type: string|null}|undefined} Foundry mapping.
 */
export function getCrdFoundryMapping(contentType) {
  return CRD_FOUNDRY_MAPPING[contentType];
}
