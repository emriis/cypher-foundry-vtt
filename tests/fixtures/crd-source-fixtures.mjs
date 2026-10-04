/**
 * Representative source fixtures taken from the 2026-07-29 CRD.
 *
 * These fixtures are intentionally small. They verify that source mechanics
 * can be represented structurally before the full CRD extraction is built.
 */

export const CRD_FIXTURE_IDS = Object.freeze({
  frenzy: "0123456789abc001",
  wildernessSurvival: "0123456789abc002",
  woundedFury: "0123456789abc003",
  barbarian: "0123456789abc004",
  howlsAtTheMoon: "0123456789abc005",
  beastForm: "0123456789abc006",
  callUponTheBeast: "0123456789abc007",
  keenEye: "0123456789abc008",
  shotgun: "0123456789abc009",
  backpack: "0123456789abc010",
  adhesionBomb: "0123456789abc011",
  angelicWard: "0123456789abc012",
  mediumArmor: "0123456789abc013",
  skillWithAttacks: "0123456789abc014",
  blackDog: "0123456789abc015"
});

function provenance(logicalId, sourceLocator, sourceKind = "record") {
  return {
    version: "2026-07-29",
    logicalId,
    language: "en",
    sourceKind,
    section: "CRD representative source section",
    sourceLocator,
    transformations: ["structural field mapping only"]
  };
}

function item(id, name, type, crdType, logicalId, system, sourceLocator) {
  return {
    _id: id,
    _key: "!items!" + id,
    document: "Item",
    type,
    name,
    crdType,
    system,
    flags: {
      cypherFoundry: {
        crd: provenance(logicalId, sourceLocator)
      }
    }
  };
}

export const CRD_ABILITY_FIXTURE = item(
  CRD_FIXTURE_IDS.frenzy,
  "Frenzy",
  "ability",
  "ability",
  "ability.frenzy",
  {
    tier: 1,
    key: "frenzy",
    enabler: true,
    repeatable: false,
    cost: {
      stat: "intellect",
      amount: 1,
      options: [],
      additionalEffort: true
    },
    action: null,
    freeWeaponCategories: [],
    freeArmorCategories: [],
    freeWeaponFamilies: [],
    freeWeaponSkillCategories: [],
    chooseWeaponAttackCategory: false,
    grantedArmorItemCategory: "",
    effects: [{
      id: "base",
      name: "Frenzy",
      tier: null,
      description:
        "While in combat, you can enter a state of frenzy. While in this " +
        "state, you can’t use Intellect points, but you add +1 to your Might " +
        "Edge and your Speed Edge. This effect lasts as long as you wish, " +
        "but it ends if no combat is taking place within range of your senses.",
      effort:
        "Ease your allies’ attacks against one foe of your choice for the " +
        "rest of the combat."
    }],
    rollTables: [],
    description:
      "While in combat, you can enter a state of frenzy. While in this " +
      "state, you can’t use Intellect points, but you add +1 to your Might " +
      "Edge and your Speed Edge. This effect lasts as long as you wish, " +
      "but it ends if no combat is taking place within range of your senses."
  },
  "Fantasy Genre — Barbarian Abilities — Tier 1 — Frenzy"
);

export const CRD_TYPE_FIXTURE = item(
  CRD_FIXTURE_IDS.barbarian,
  "Barbarian",
  "type",
  "type",
  "type.barbarian",
  {
    tier: 1,
    genre: "Fantasy",
    subgenre: "",
    poolBonuses: { might: 3, speed: 1, intellect: 0 },
    edgeChoice: 1,
    woundBonuses: { minor: 3, moderate: 1, major: 0 },
    freeWeapons: true,
    freeArmor: false,
    freeWeaponCategories: [],
    freeArmorCategories: ["light", "medium"],
    freeWeaponFamilies: [],
    skillOptions: [],
    abilities: [
      "!items!" + CRD_FIXTURE_IDS.frenzy,
      "!items!" + CRD_FIXTURE_IDS.wildernessSurvival,
      "!items!" + CRD_FIXTURE_IDS.woundedFury
    ],
    abilityTiers: [
      { ability: "!items!" + CRD_FIXTURE_IDS.frenzy, tier: 1 },
      { ability: "!items!" + CRD_FIXTURE_IDS.wildernessSurvival, tier: 1 },
      { ability: "!items!" + CRD_FIXTURE_IDS.woundedFury, tier: 1 }
    ],
    statOptions: []
  },
  "Fantasy Genre — Barbarian Abilities"
);

export const CRD_FOCUS_FIXTURE = item(
  CRD_FIXTURE_IDS.howlsAtTheMoon,
  "Howls at the Moon",
  "focus",
  "focus",
  "focus.howls-at-the-moon",
  {
    abilities: [
      "!items!" + CRD_FIXTURE_IDS.beastForm,
      "!items!" + CRD_FIXTURE_IDS.callUponTheBeast,
      "!items!" + CRD_FIXTURE_IDS.keenEye
    ],
    flowchart: {
      edges: []
    },
    description:
      "For brief periods, you become a fearsome and powerful creature with " +
      "control issues."
  },
  "Fantasy Genre — Howls at the Moon — Tier 1"
);

export const CRD_WEAPON_FIXTURE = item(
  CRD_FIXTURE_IDS.shotgun,
  "Shotgun",
  "attack",
  "weapon",
  "weapon.shotgun",
  {
    attackType: "heavy",
    range: "immediate",
    extremeRange: "short",
    damage: 6,
    stat: "might",
    weaponFamily: "",
    attackSkillCategory: "",
    priceCategory: "expensive",
    properties: ["attack hindered if fired with one hand"],
    freelyUsable: false,
    equipped: false,
    description:
      "Heavy weapon, immediate range, extreme range extends to short range, " +
      "attack hindered if fired with one hand."
  },
  "Real-World Equipment — Expensive Items — Shotgun"
);

export const CRD_EQUIPMENT_FIXTURE = item(
  CRD_FIXTURE_IDS.backpack,
  "Backpack",
  "equipment",
  "equipment",
  "equipment.backpack",
  {
    quantity: 1,
    level: 4,
    priceCategory: "moderate",
    weight: "light",
    equipped: false,
    depletionDie: "none",
    depletionThreshold: 1,
    depleted: false,
    description: ""
  },
  "Real-World Equipment — Moderately Priced Items — Backpack"
);

export const CRD_CYPHER_FIXTURE = item(
  CRD_FIXTURE_IDS.adhesionBomb,
  "Adhesion Bomb",
  "cypher",
  "cypher",
  "cypher.adhesion-bomb",
  {
    cypherType: "manifest",
    level: "",
    powerLevel: "medium",
    internal: false,
    identified: true,
    depleted: false,
    description:
      "Creates an immediate-radius explosion of sticky goo up to a short " +
      "distance away. Make separate Speed attacks against each creature in " +
      "the area. Success means they are held in place."
  },
  "Medium-Power Manifest Cyphers — Adhesion bomb"
);


export const CRD_ARTIFACT_FIXTURE = item(
  CRD_FIXTURE_IDS.angelicWard,
  "Angelic Ward",
  "artifact",
  "artifact",
  "artifact.angelic-ward",
  {
    level: "1d6+2",
    form: "Tiny figurine of a winged angel",
    identified: true,
    depletionDie: "d10",
    depletionThreshold: 1,
    depleted: false,
    description: ""
  },
  "Fantasy Genre — Major Fantasy Artifacts — Angelic Ward"
);

export const CRD_ARMOR_FIXTURE = item(
  CRD_FIXTURE_IDS.mediumArmor,
  "Medium Armor",
  "armor",
  "armor",
  "armor.medium",
  {
    category: "medium",
    freelyUsable: false,
    equipped: false,
    blockEaseDamage: 0,
    priceCategory: "veryExpensive",
    description: ""
  },
  "Fantasy Genre — Equipment — Medium Armor"
);

export const CRD_SKILL_FIXTURE = item(
  CRD_FIXTURE_IDS.skillWithAttacks,
  "Skill With Attacks",
  "skill",
  "skill",
  "skill.skill-with-attacks",
  {
    stat: "none",
    level: "trained",
    attackCategory: "heavyRanged",
    minimumTier: 3,
    description:
      "Choose one attack category in which you are not already trained."
  },
  "Character Creation — Third-Tier Skills and Knowledge Abilities — Skill With Attacks"
);

export const CRD_CREATURE_FIXTURE = {
  _id: CRD_FIXTURE_IDS.blackDog,
  _key: "!actors!" + CRD_FIXTURE_IDS.blackDog,
  document: "Actor",
  type: "npc",
  name: "Black Dog",
  crdType: "creature",
  system: {
    level: 6,
    health: { max: 20, value: 20 },
    armor: 2,
    damage: "8",
    movement: "long; very long when running",
    modifications: "Sneaking, hiding, and attacking from surprise or advantage as level 7",
    combat: "Spectral teeth and claws inflict 8 points of damage.",
    interaction:
      "Helpful black dogs are unpredictable companions; malevolent ones are best avoided.",
    use: "A black dog can guide lost characters or appear during a dangerous encounter.",
    loot: "Black dogs rarely have anything valuable.",
    gmNotes: ""
  },
  flags: {
    cypherFoundry: {
      crd: provenance(
        "creature.black-dog",
        "Fantasy Genre — Creatures — Black Dog"
      )
    }
  }
};

export const CRD_TIERED_ABILITY_FIXTURE = item(
  "0123456789abc016",
  "Howls at the Moon — Tiered Effects",
  "ability",
  "ability",
  "ability.howls-at-the-moon-tiered-effects",
  {
    tier: 1,
    key: "howls-at-the-moon-tiered-effects",
    enabler: true,
    repeatable: false,
    cost: {
      stat: "none",
      amount: 0,
      options: [],
      additionalEffort: false
    },
    action: null,
    freeWeaponCategories: [],
    freeArmorCategories: [],
    freeWeaponFamilies: [],
    freeWeaponSkillCategories: [],
    chooseWeaponAttackCategory: false,
    grantedArmorItemCategory: "",
    effects: [
      {
        id: "tier-3",
        name: "Bigger Beast Form",
        tier: 3,
        description:
          "The beast form becomes larger and gains additional physical benefits.",
        effort: ""
      },
      {
        id: "tier-6",
        name: "Perfect Control",
        tier: 6,
        description:
          "The character can change between beast and normal form without a roll.",
        effort: ""
      }
    ],
    rollTables: [],
    description:
      "Representative tier progression for the Howls at the Moon focus."
  },
  "Fantasy Genre — Howls at the Moon — Tier 3 and Tier 6"
);

export const CRD_FIXTURES = Object.freeze([
  CRD_ABILITY_FIXTURE,
  CRD_TYPE_FIXTURE,
  CRD_FOCUS_FIXTURE,
  CRD_WEAPON_FIXTURE,
  CRD_EQUIPMENT_FIXTURE,
  CRD_CYPHER_FIXTURE,
  CRD_ARTIFACT_FIXTURE,
  CRD_ARMOR_FIXTURE,
  CRD_SKILL_FIXTURE,
  CRD_CREATURE_FIXTURE,
  CRD_TIERED_ABILITY_FIXTURE
]);
