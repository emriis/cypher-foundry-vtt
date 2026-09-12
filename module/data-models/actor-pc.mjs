import { CYPHER } from "../config.mjs";

const { SchemaField, NumberField, StringField, HTMLField, BooleanField, ArrayField } = foundry.data.fields;

export default class CypherPCData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const statSchema = () => new SchemaField({
      pool: new SchemaField({
        max: new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
        value: new NumberField({ required: true, integer: true, initial: 8, min: 0 })
      }),
      edge: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
    });

    // Une sévérité de blessure : cases max et cases actuellement cochées
    // A wound severity: max boxes and currently checked boxes
    const woundSchema = (max) => new SchemaField({
      max: new NumberField({ required: true, integer: true, initial: max, min: 0 }),
      current: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
    });

    return {
      // Descripteur, Type, Foyer — ex. "Fourbe Guerrier qui Manie deux armes"
      // Descriptor, Type, Focus — e.g. "Clever Warrior who Wields Two Weapons"
      descriptor: new StringField({ required: true, blank: true }),
      type: new StringField({ required: true, blank: true }),
      focus: new StringField({ required: true, blank: true }),

      // Genre de jeu : détermine si Type/Foyer sont utilisés (Monde Réel n'en a pas, voir
      // "Profession" ci-dessous) et active les champs propres au genre (Rang/Décalages pour
      // Super-héros). Genre: determines whether Type/Focus are used (Real World has none, see
      // "Profession" below) and enables genre-specific fields (Rank/Shifts for Superhero).
      genre: new StringField({ required: true, initial: "none", choices: CYPHER.genres }),

      // Espèce (optionnelle) : fantasy/SF/super-héros. Certaines espèces (ex. Humain) accordent
      // un second descripteur — à activer manuellement via le bouton dédié.
      // Species (optional): fantasy/sci-fi/superhero. Some species (e.g. Human) grant a second
      // descriptor — toggle it manually via the dedicated button.
      species: new StringField({ required: true, blank: true }),

      // Profession : remplace Type/Foyer pour un personnage Monde Réel (ex. avocat, médecin...).
      // Profession: replaces Type/Focus for a Real-World character (e.g. lawyer, doctor...).
      profession: new StringField({ required: true, blank: true }),

      // Rang (1-5) et Décalages de Pouvoir : uniquement pour le genre Super-héros
      // Rank (1-5) and Power Shifts: superhero genre only
      rank: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 5 }),
      powerShifts: new SchemaField(
        Object.fromEntries(CYPHER.powerShiftCategories.map(cat =>
          [cat, new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 3 })]
        ))
      ),

      // Second descripteur et second foyer : optionnels, absents par défaut (CRD : espèce
      // Humain donne un 2e descripteur ; avancement super-héros "Second Focus" donne un 2e foyer)
      // Second descriptor and second focus: optional, absent by default (CRD: Human species
      // grants a 2nd descriptor; the superhero "Second Focus" advancement grants a 2nd focus)
      hasSecondDescriptor: new BooleanField({ required: true, initial: false }),
      descriptor2: new StringField({ required: true, blank: true }),
      hasSecondFocus: new BooleanField({ required: true, initial: false }),
      focus2: new StringField({ required: true, blank: true }),

      tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
      effort: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      xp: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      // Points de Ressource, gagnés à chaque avancement (voir "Resource Points" du CRD)
      // Resource Points, gained on each advancement (see the CRD's "Resource Points")
      resourcePoints: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      stats: new SchemaField({
        might: statSchema(),
        speed: statSchema(),
        intellect: statSchema()
      }),

      // Statistiques additionnelles optionnelles, définies librement par la table de jeu
      // (aucune par défaut — extension maison en plus de Puissance/Vitesse/Intelligence).
      // Optional additional stats, freely defined by the table (none by default —
      // a homebrew extension on top of Might/Speed/Intellect).
      customStats: new ArrayField(new SchemaField({
        id: new StringField({ required: true, blank: false }),
        label: new StringField({ required: true, blank: false }),
        pool: new SchemaField({
          max: new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
          value: new NumberField({ required: true, integer: true, initial: 8, min: 0 })
        }),
        edge: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }), { required: true, initial: [] }),

      // Blessures : trois sévérités, chacune avec ses propres cases
      // Wounds: three severities, each with its own boxes
      wounds: new SchemaField({
        minor: woundSchema(CYPHER.defaultWoundMax.minor),
        moderate: woundSchema(CYPHER.defaultWoundMax.moderate),
        major: woundSchema(CYPHER.defaultWoundMax.major)
      }),

      // Armure portée : catégorie + capacité à l'utiliser librement (sinon le handicap
      // d'esquive s'applique à TOUTES les tâches de Vitesse, pas seulement à l'esquive)
      // Worn armor: category + whether it's freely usable (otherwise the dodge penalty
      // applies to ALL Speed tasks, not just dodge rolls)
      // NOTE : l'armure active (catégorie, dégâts...) n'est plus stockée ici — elle est
      // entièrement dérivée de l'objet Armure actuellement Équipé en inventaire (voir
      // prepareDerivedData). Un seul objet Armure peut être équipé à la fois.
      // NOTE: the active armor (category, damage...) is no longer stored here — it's fully
      // derived from the currently Equipped Armor item in inventory (see prepareDerivedData).
      // Only one Armor item can be equipped at a time.

      recoveries: new SchemaField({
        // Une coche par intervalle de récupération quotidien / one checkbox per daily recovery interval
        action: new BooleanField({ initial: false }),
        tenMinutes: new BooleanField({ initial: false }),
        hour: new BooleanField({ initial: false }),
        tenHours: new BooleanField({ initial: false })
      }),

      // Limite de cyphers portés simultanément / Cypher limit
      cypherLimit: new NumberField({ required: true, integer: true, initial: 2, min: 0 }),

      // Bonus permanent aux jets de récupération (ex. +2 via l'avancement "Autre : Récupération")
      // Permanent bonus to recovery rolls (e.g. +2 from the "Other: Recovery" advancement)
      recoveryBonus: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Acquis via l'avancement "Autre" : utilisation libre de toutes les armures/armes
      // Gained via the "Other" advancement: free use of all armor/weapon categories
      canFreelyUseAllArmor: new BooleanField({ required: true, initial: false }),
      canFreelyUseAllWeapons: new BooleanField({ required: true, initial: false }),

      // Les 4 emplacements d'avancement du palier courant. Une fois les 4 achetés, le
      // personnage passe au palier suivant et les emplacements se réinitialisent.
      // The 4 advancement slots for the current tier. Once all 4 are bought, the character
      // advances a tier and the slots reset.
      advancementSlots: new ArrayField(new SchemaField({
        type: new StringField({ required: true, blank: true, initial: "", choices: ["", ...CYPHER.advancementTypes] }),
        otherType: new StringField({ required: true, blank: true, initial: "", choices: ["", ...CYPHER.otherAdvancementTypes] }),
        bought: new BooleanField({ required: true, initial: false })
      }), {
        required: true,
        initial: [
          { type: "", otherType: "", bought: false },
          { type: "", otherType: "", bought: false },
          { type: "", otherType: "", bought: false },
          { type: "", otherType: "", bought: false }
        ]
      }),

      additionalAbilities: new StringField({ required: true, blank: true }),

      // Champs Libres : une liste de champs entièrement définis par le joueur (texte, nombre,
      // ou case à cocher), pour ajouter n'importe quel élément non prévu par le système —
      // indépendant du genre choisi.
      // Custom Fields: a list of fields fully defined by the player (text, number, or
      // checkbox), to add anything the system doesn't already provide for — independent
      // of the chosen genre.
      customFields: new ArrayField(new SchemaField({
        id: new StringField({ required: true, blank: false }),
        label: new StringField({ required: true, blank: false }),
        fieldType: new StringField({ required: true, initial: "text", choices: CYPHER.customFieldTypes }),
        valueText: new StringField({ required: true, blank: true }),
        valueNumber: new NumberField({ required: true, initial: 0 }),
        valueBoolean: new BooleanField({ required: true, initial: false })
      }), { required: true, initial: [] }),

      biography: new HTMLField({ required: true, blank: true }),
      notes: new HTMLField({ required: true, blank: true })
    };
  }

  /** Points préparés dérivés — calculs de valeurs affichées / Derived, prepared values */
  prepareDerivedData() {
    // Toute la méthode est protégée : une erreur ici ne doit JAMAIS empêcher la fiche de
    // s'ouvrir (elle s'affichera avec des valeurs dérivées provisoires/par défaut à la place).
    // The whole method is guarded: an error here must NEVER prevent the sheet from opening
    // (it will render with provisional/default derived values instead).
    try {
      this._prepareDerivedDataUnsafe();
    } catch (err) {
      console.error("Cypher | Erreur lors du calcul des données dérivées du personnage :", err);
      this._applyDerivedDataFallback();
    }
  }

  _prepareDerivedDataUnsafe() {
    for (const stat of CYPHER.stats) {
      const s = this.stats[stat];
      s.depleted = s.pool.value <= 0;
    }
    for (const custom of this.customStats) {
      custom.depleted = custom.pool.value <= 0;
    }

    // Handicap cumulatif : +1 pas si la dernière case de blessure modérée est cochée,
    // +1 pas par blessure majeure subie (elles s'additionnent).
    // Cumulative hindrance: +1 step if the last moderate wound box is checked,
    // +1 step per major wound taken (these stack).
    const w = this.wounds;
    let hinderSteps = 0;
    if (w.moderate.current >= w.moderate.max && w.moderate.max > 0) hinderSteps += 1;
    hinderSteps += w.major.current;

    this.hindered = hinderSteps > 0;
    this.hinderSteps = hinderSteps;
    this.stepModifier = -hinderSteps;

    this.dead = w.major.current >= w.major.max && w.major.max > 0;

    // Genre-dependent derived values / valeurs dérivées selon le genre
    this.isSuperhero = this.genre === "superhero";
    this.isRealWorld = this.genre === "realWorld";
    this.isCustomGenre = this.genre === "custom";
    this.usesTypeAndFocus = this.genre !== "realWorld";
    // Le genre "Personnalisé" déverrouille Profession ET le bloc Super-héros en plus de
    // Type/Foyer/Espèce, pour permettre de composer un personnage entièrement à la carte.
    // The "Custom" genre unlocks Profession AND the Superhero block in addition to
    // Type/Focus/Species, to allow composing a fully à la carte character.
    this.showProfession = this.isRealWorld || this.isCustomGenre;
    this.showSuperheroBlock = this.isSuperhero || this.isCustomGenre;
    this.maxDifficulty = this.isSuperhero ? CYPHER.maxDifficulty.superhero : CYPHER.maxDifficulty.standard;
    // Seul le genre Super-héros permet de se rallier pour retirer une blessure majeure (10 Puissance)
    // Only the Superhero genre allows rallying to remove a major wound (10 Might)
    this.canRallyMajor = this.isSuperhero;

    this.powerShiftTotal = Object.values(this.powerShifts).reduce((sum, v) => sum + v, 0);

    // Armure active : entièrement dérivée de l'objet Armure actuellement Équipé en inventaire.
    // S'il n'y en a aucun (ou si la collection d'objets n'est pas encore prête au moment de ce
    // calcul — cas réel documenté par Foundry lors de certains flux de création/import), l'armure
    // retombe sur "aucune" sans jamais lever d'erreur.
    // Active armor: fully derived from the Armor item currently Equipped in inventory. If there
    // is none (or the items collection isn't ready yet at the time of this computation — a real,
    // documented Foundry timing case during certain creation/import flows), armor falls back to
    // "none" without ever throwing.
    let equippedArmorItem = null;
    const itemsCollection = this.parent?.items;
    if (itemsCollection && typeof itemsCollection.find === "function") {
      equippedArmorItem = itemsCollection.find(i => i?.type === "armor" && i?.system?.equipped === true) ?? null;
    }
    const category = equippedArmorItem?.system?.category ?? "none";
    const armorSteps = CYPHER.armorCategories[category] ?? { block: 0, dodge: 0 };
    const blockEaseDamage = equippedArmorItem?.system?.blockEaseDamage ?? 0;
    // Le bonus de Blocage est réduit par les dégâts subis par l'armure ; le handicap d'Esquive
    // n'est JAMAIS affecté par ces dégâts (règle du CRD).
    // The Block bonus is reduced by damage the armor has taken; the Dodge hindrance is NEVER
    // affected by this damage (per the CRD rule).
    // Si l'armure n'est pas utilisée librement (et que l'avancement "Armure" n'a pas été
    // acheté), son handicap d'esquive touche TOUTES les tâches de Vitesse.
    // If the armor isn't freely usable (and the "Armor" advancement wasn't bought),
    // its dodge penalty hinders ALL Speed tasks.
    const freelyUsable = (equippedArmorItem?.system?.freelyUsable ?? false) || this.canFreelyUseAllArmor;

    this.armor = {
      itemId: equippedArmorItem?.id ?? null,
      name: equippedArmorItem?.name ?? null,
      category,
      freelyUsable,
      baseBlockEase: armorSteps.block,
      blockEaseDamage,
      blockEase: Math.max(0, armorSteps.block - blockEaseDamage),
      damaged: blockEaseDamage > 0,
      dodgeHinder: armorSteps.dodge,
      speedTaskHinder: freelyUsable ? 0 : armorSteps.dodge
    };

    // Emplacements d'avancement du palier courant / current tier's advancement slots
    this.advancementBoughtCount = this.advancementSlots.filter(s => s.bought).length;
    this.advancementComplete = this.advancementBoughtCount >= 4;
  }

  /**
   * Valeurs de repli minimales si le calcul complet échoue — la fiche reste utilisable.
   * Minimal fallback values if the full computation fails — the sheet stays usable.
   */
  _applyDerivedDataFallback() {
    this.hindered ??= false;
    this.hinderSteps ??= 0;
    this.stepModifier ??= 0;
    this.dead ??= false;
    this.isSuperhero ??= false;
    this.isRealWorld ??= false;
    this.isCustomGenre ??= false;
    this.usesTypeAndFocus ??= true;
    this.showProfession ??= false;
    this.showSuperheroBlock ??= false;
    this.maxDifficulty ??= CYPHER.maxDifficulty.standard;
    this.canRallyMajor ??= false;
    this.powerShiftTotal ??= 0;
    this.armor ??= {
      itemId: null, name: null, category: "none", freelyUsable: false,
      baseBlockEase: 0, blockEaseDamage: 0, blockEase: 0, damaged: false,
      dodgeHinder: 0, speedTaskHinder: 0
    };
    this.advancementBoughtCount ??= 0;
    this.advancementComplete ??= false;
  }
}
