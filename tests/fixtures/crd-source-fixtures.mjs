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
  mediumArmor: "0123456789abc013",
  skillWithAttacks: "0123456789abc014",
  brewPotion: "0123456789abc016",
  fury: "0123456789abc017"
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
        "rest of the combat.",
      modifiers: [
        { kind: "edge", stat: "might", severity: "", amount: 1 },
        { kind: "edge", stat: "speed", severity: "", amount: 1 }
      ],
      endConditions: []
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

export const CRD_RECOVERY_ABILITY_FIXTURE = item(
  CRD_FIXTURE_IDS.fury,
  "Fury",
  "ability",
  "ability",
  "ability.fury",
  {
    tier: 1,
    key: "fury",
    enabler: false,
    repeatable: false,
    cost: {
      stat: "might",
      amount: 3,
      options: [],
      additionalEffort: false
    },
    action: "action",
    freeWeaponCategories: [],
    freeArmorCategories: [],
    freeWeaponFamilies: [],
    freeWeaponSkillCategories: [],
    chooseWeaponAttackCategory: false,
    grantedArmorItemCategory: "",
    effects: [{
      id: "base",
      name: "Fury",
      tier: null,
      description:
        "Your melee attacks inflict +2 damage. This ability lasts until " +
        "you use a ten-minute or longer recovery.",
      effort: "",
      modifiers: [],
      endConditions: [{
        kind: "recovery",
        interval: "tenMinutes",
        minimum: true
      }]
    }],
    rollTables: [],
    description:
      "Your melee attacks inflict +2 damage. This ability lasts until " +
      "you use a ten-minute or longer recovery."
  },
  "Fantasy Genre — High-Tier Fantasy Abilities — Fury"
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
    mechanics: {
      twoHanded: true,
      rapidFire: false,
      ignoresPhysicalArmor: 0,
      cutsThroughMaterialsLevel: null,
      targetEffects: [],
      requiresTripod: false,
      requiredOperators: 0,
      alternateConfiguration: {
        enabled: false,
        attackType: "",
        action: ""
      }
    },
    freelyUsable: false,
    equipped: false,
    description:
      "Heavy weapon, immediate range, extreme range extends to short range, " +
      "attack hindered if fired with one hand."
  },
  "Real-World Equipment — Expensive Items — Shotgun"
);


export const CRD_QUARTERSTAFF_FIXTURE = item(
  "0123456789abc018",
  "Quarterstaff",
  "attack",
  "weapon",
  "weapon.quarterstaff",
  {
    attackType: "medium",
    range: "immediate",
    extremeRange: "",
    damage: 4,
    stat: "might",
    weaponFamily: "",
    attackSkillCategory: "",
    priceCategory: "expensive",
    properties: ["requires two hands"],
    mechanics: {
      twoHanded: true,
      rapidFire: false,
      ignoresPhysicalArmor: 0,
      cutsThroughMaterialsLevel: null,
      targetEffects: [],
      requiresTripod: false,
      requiredOperators: 0,
      alternateConfiguration: {
        enabled: false,
        attackType: "",
        action: ""
      }
    },
    freelyUsable: false,
    equipped: false,
    description: "Medium weapon (requires two hands)."
  },
  "Fantasy Equipment — Expensive Items — Quarterstaff"
);

export const CRD_STUNSTICK_FIXTURE = item(
  "0123456789abc019",
  "Stunstick",
  "attack",
  "weapon",
  "weapon.stunstick",
  {
    attackType: "medium",
    range: "immediate",
    extremeRange: "",
    damage: 0,
    stat: "might",
    weaponFamily: "",
    attackSkillCategory: "",
    priceCategory: "expensive",
    properties: [
      "inflicts no damage",
      "level 2 or lower creature loses their next action",
      "level 3 or higher is hindered by two steps for a round or two"
    ],
    mechanics: {
      twoHanded: false,
      rapidFire: false,
      ignoresPhysicalArmor: 0,
      cutsThroughMaterialsLevel: null,
      targetEffects: [
        {
          minimumTargetLevel: 0,
          maximumTargetLevel: 2,
          effect: "loseNextAction",
          hinderSteps: 0,
          duration: "next action"
        },
        {
          minimumTargetLevel: 3,
          maximumTargetLevel: null,
          effect: "hindered",
          hinderSteps: 2,
          duration: "a round or two"
        }
      ],
      requiresTripod: false,
      requiredOperators: 0,
      alternateConfiguration: {
        enabled: false,
        attackType: "",
        action: ""
      }
    },
    freelyUsable: false,
    equipped: false,
    description: ""
  },
  "Science Fiction Equipment — Expensive Items — Stunstick"
);

export const CRD_MONOMOLECULAR_BLADE_FIXTURE = item(
  "0123456789abc020",
  "Monomolecular blade",
  "attack",
  "weapon",
  "weapon.monomolecular-blade",
  {
    attackType: "light",
    range: "immediate",
    extremeRange: "",
    damage: 2,
    stat: "might",
    weaponFamily: "",
    attackSkillCategory: "",
    priceCategory: "veryExpensive",
    properties: [
      "ignores 1 point of physical armor",
      "cuts through physical materials up to level 6"
    ],
    mechanics: {
      twoHanded: false,
      rapidFire: false,
      ignoresPhysicalArmor: 1,
      cutsThroughMaterialsLevel: 6,
      targetEffects: [],
      requiresTripod: false,
      requiredOperators: 0,
      alternateConfiguration: {
        enabled: false,
        attackType: "",
        action: ""
      }
    },
    freelyUsable: false,
    equipped: false,
    description: ""
  },
  "Science Fiction Equipment — Very Expensive Items — Monomolecular blade"
);

export const CRD_VACUUM_ASSAULT_RIFLE_FIXTURE = item(
  "0123456789abc021",
  "Vacuum assault rifle",
  "attack",
  "weapon",
  "weapon.vacuum-assault-rifle",
  {
    attackType: "heavy",
    range: "long",
    extremeRange: "",
    damage: 6,
    stat: "speed",
    weaponFamily: "",
    attackSkillCategory: "",
    priceCategory: "veryExpensive",
    properties: [
      "rapid-fire weapon",
      "can switch to medium weapon configuration as an action"
    ],
    mechanics: {
      twoHanded: true,
      rapidFire: true,
      ignoresPhysicalArmor: 0,
      cutsThroughMaterialsLevel: null,
      targetEffects: [],
      requiresTripod: false,
      requiredOperators: 0,
      alternateConfiguration: {
        enabled: true,
        attackType: "medium",
        action: "action"
      }
    },
    freelyUsable: false,
    equipped: false,
    description: ""
  },
  "Science Fiction Equipment — Very Expensive Items — Vacuum assault rifle"
);

export const CRD_BLAST_CANNON_FIXTURE = item(
  "0123456789abc022",
  "Blast cannon",
  "attack",
  "weapon",
  "weapon.blast-cannon",
  {
    attackType: "heavy",
    range: "veryLong",
    extremeRange: "",
    damage: 10,
    stat: "might",
    weaponFamily: "",
    attackSkillCategory: "",
    priceCategory: "exorbitant",
    properties: [
      "requires a tripod and two people to operate",
      "rapid-fire weapon"
    ],
    mechanics: {
      twoHanded: true,
      rapidFire: true,
      ignoresPhysicalArmor: 0,
      cutsThroughMaterialsLevel: null,
      targetEffects: [],
      requiresTripod: true,
      requiredOperators: 2,
      alternateConfiguration: {
        enabled: false,
        attackType: "",
        action: ""
      }
    },
    freelyUsable: false,
    equipped: false,
    description: ""
  },
  "Science Fiction Equipment — Exorbitant Items — Blast cannon"
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
    equipped: false,
    depletionDie: "none",
    depletionMin: 1,
    depletionMax: 1,
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
    level: 6,
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



export const CRD_ARMOR_FIXTURE = item(
  "0123456789abc013",
  "Leather jacket",
  "armor",
  "armor",
  "armor.leather-jacket",
  {
    category: "light",
    freelyUsable: false,
    equipped: false,
    blockEaseDamage: 0,
    priceCategory: "moderate",
    description: ""
  },
  "Real-World Equipment — Moderately Priced Items — Leather jacket"
);

export const CRD_SKILL_FIXTURE = item(
  "0123456789abc014",
  "Attacking",
  "skill",
  "skill",
  "skill.attacking",
  {
    stat: "none",
    level: "trained",
    attackCategory: "",
    minimumTier: 2,
    minimumSpecializationTier: 4,
    description: ""
  },
  "Character Creation — Tier-Restricted Skills — Master Skill List — Attacking (tier-restricted)"
);

export const CRD_TIERED_ABILITY_FIXTURE = item(
  CRD_FIXTURE_IDS.brewPotion,
  "Brew Potion",
  "ability",
  "ability",
  "ability.brew-potion",
  {
    tier: 1,
    key: "brew-potion",
    enabler: false,
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
        id: "base",
        name: "Brew Potion",
        tier: null,
        description:
          "You brew a potion. You can choose its effect from the " +
          "Low-Power Manifest Cyphers table. Your brewed potion cypher " +
          "counts toward your cypher limit.",
        effort: "",
        modifiers: [],
        endConditions: []
      },
      {
        id: "tier-3",
        name: "Tier 3 effect",
        tier: 3,
        description:
          "You can choose a low or medium-power manifest cypher as " +
          "your brewed potion.",
        effort: "",
        modifiers: [],
        endConditions: []
      },
      {
        id: "tier-6",
        name: "Tier 6 effect",
        tier: 6,
        description:
          "You can choose a low, medium-, or advanced-power manifest " +
          "cypher as your brewed potion.",
        effort: "",
        endConditions: []
      }
    ],
    rollTables: [],
    description:
      "You brew a potion. You can choose its effect from the " +
      "Low-Power Manifest Cyphers table. Ten minutes to brew."
  },
  "Fantasy Genre — Witch Abilities — Tier 1 — Brew Potion"
);

export const CRD_FIXTURES = Object.freeze([
  CRD_ABILITY_FIXTURE,
  CRD_TYPE_FIXTURE,
  CRD_FOCUS_FIXTURE,
  CRD_WEAPON_FIXTURE,
  CRD_QUARTERSTAFF_FIXTURE,
  CRD_STUNSTICK_FIXTURE,
  CRD_MONOMOLECULAR_BLADE_FIXTURE,
  CRD_VACUUM_ASSAULT_RIFLE_FIXTURE,
  CRD_BLAST_CANNON_FIXTURE,
  CRD_EQUIPMENT_FIXTURE,
  CRD_CYPHER_FIXTURE,
  CRD_ARMOR_FIXTURE,
  CRD_SKILL_FIXTURE,
  CRD_TIERED_ABILITY_FIXTURE,
  CRD_RECOVERY_ABILITY_FIXTURE
]);
