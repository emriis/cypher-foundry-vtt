export const CYPHER = {};

/* Les trois stats du Cypher / The three Cypher stats */
CYPHER.stats = ["might", "speed", "intellect"];

/* Niveaux de compétence — modificateurs de pas appliqués à la difficulté
   Skill training levels — step modifiers applied to task difficulty.
   inability = hindered 1 step ; none = untrained ; trained = eased 1 ;
   specialized = eased 2 ; expert = eased 3 (requires a special ability, per rules) */
CYPHER.skillLevels = {
  inability: -1,
  none: 0,
  trained: 1,
  specialized: 2,
  expert: 3
};

/* Sévérités de blessure, dans l'ordre croissant / Wound severities, ascending order */
CYPHER.woundSeverities = ["minor", "moderate", "major"];

/* Nombre de cases par défaut pour un personnage de base (peut être augmenté par le Type)
   Default wound boxes for a core character (Types can grant more) */
CYPHER.defaultWoundMax = { minor: 3, moderate: 3, major: 3 };

/* Conversion des dégâts en Points de Réserve (ex. poison, maladie, attaque psychique)
   qui débordent une fois la Réserve à 0, en sévérité de blessure.
   Pool-damage-to-wound conversion, used when a Pool hits 0 and damage overflows. */
CYPHER.poolDamageToWound = [
  { max: 4, severity: "minor" },
  { max: 8, severity: "moderate" },
  { max: Infinity, severity: "major" }
];

CYPHER.tiers = [1, 2, 3, 4, 5, 6];

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

/* Cases de blessure par défaut d'un bouclier — différentes de celles d'un PJ
   Default wound boxes for a shield — different from a PC's */
CYPHER.defaultShieldWoundMax = { minor: 3, moderate: 2, major: 1 };

CYPHER.cypherTypes = ["subtle", "manifest"];

/* Coût en points de Réserve par niveau d'Effort : 3 pour le premier niveau, 2 pour chacun des suivants
   Effort cost per level: 3 for the first level, 2 for each additional level (before Edge discount) */
CYPHER.effortCostFirstLevel = 3;
CYPHER.effortCostAdditionalLevel = 2;

CYPHER.recoveryIntervals = ["action", "tenMinutes", "hour", "tenHours"];

/* Genres de jeu pris en charge par la fiche / Genres supported by the sheet.
   "custom" déverrouille TOUS les champs de genre à la fois (Type+Foyer+Espèce+Profession+
   Rang/Décalages), pour une création de personnage entièrement à la carte.
   "custom" unlocks ALL genre fields at once (Type+Focus+Species+Profession+Rank/Shifts),
   for fully à la carte character creation. */
CYPHER.genres = ["none", "realWorld", "fantasy", "sciFi", "superhero", "custom"];

/* Types de champ disponibles pour les Champs Libres (section entièrement personnalisable)
   Available field types for Custom Fields (fully user-defined section) */
CYPHER.customFieldTypes = ["text", "number", "checkbox"];

/* Dés d'épuisement possibles pour un Artefact ou un Équipement à charges (ex. "1 en 1d20")
   Possible depletion dice for an Artifact or a charge-based Equipment (e.g. "1 in 1d20") */
CYPHER.depletionDice = ["d6", "d8", "d10", "d12", "d20"];
CYPHER.depletionDieMax = { d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

/* Catégories de Décalage de Pouvoir (super-héros), chacune plafonnée à 3 par personnage
   Power Shift categories (superhero), each capped at 3 per character */
CYPHER.powerShiftCategories = [
  "accuracy", "dexterity", "flight", "healing", "increasedRange",
  "intelligence", "power", "prodigy", "resilience", "savant", "singleAttack", "strength"
];

/* Coût de Ralliement d'une blessure majeure — réservé au genre super-héros
   Cost to rally a major wound — superhero genre only */
CYPHER.rallyCostMajorSuperhero = 10;

/* Difficulté maximale des tâches : 10 normalement, 15 en super-héros ("impossible tasks")
   Maximum task difficulty: 10 normally, 15 for superhero games ("impossible tasks") */
CYPHER.maxDifficulty = { standard: 10, superhero: 15 };

/* Économie de Points d'Expérience (PX) / Experience Point (XP) economy */
CYPHER.xpCosts = {
  reroll: 1,
  playerIntrusion: 1,
  luckyShot: 1,
  advancementSlot: 4
};

/* Les 4 emplacements d'avancement par palier ; "other" est un remplacement au choix de l'un
   des 4 emplacements standards. The 4 advancement slots per tier; "other" is a substitute
   for one of the 4 standard slots. */
CYPHER.advancementTypes = ["capabilities", "perfection", "effort", "skill", "other"];
CYPHER.otherAdvancementTypes = ["recovery", "focus", "armor", "weapons", "genre"];

/* Dégâts de base par catégorie d'arme / Base damage by weapon category */
CYPHER.weaponDamage = { light: 2, medium: 4, heavy: 6 };

/* Catégories d'armure des PJ : facilite le Blocage (pas), handicape l'Esquive (pas)
   PC armor categories: eases Block (steps), hinders Dodge (steps) */
CYPHER.armorCategories = {
  light: { block: 1, dodge: 1 },
  medium: { block: 2, dodge: 2 },
  heavy: { block: 3, dodge: 3 }
};

/* Coût de Ralliement (points de Puissance) pour retirer une blessure — les blessures majeures
   ne peuvent pas être ralliées (hors genre super-héros).
   Rally cost (Might points) to remove a wound — major wounds can't be rallied (outside superhero genre) */
CYPHER.rallyCost = { minor: 2, moderate: 5 };

/* Icônes de statut / status icons */
CYPHER.statusIcons = {
  hindered: "icons/svg/downgrade.svg",
  dead: "icons/svg/skull.svg"
};
