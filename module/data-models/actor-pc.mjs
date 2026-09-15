import { CYPHER } from "../config.mjs";

const { SchemaField, NumberField, StringField, HTMLField, BooleanField, ArrayField } = foundry.data.fields;

/**
 * Defines the stored and derived data model for a Cypher player character.
 *
 * Stored fields represent persistent sheet state. Derived properties are
 * computed from actor data and the actor's embedded inventory.
 */
export default class CypherPCData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const statSchema = () => new SchemaField({
      pool: new SchemaField({
        max: new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
        value: new NumberField({ required: true, integer: true, initial: 8, min: 0 })
      }),
      edge: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
    });

    // Defines the maximum and currently checked boxes for one wound severity.
    const woundSchema = (max) => new SchemaField({
      max: new NumberField({ required: true, integer: true, initial: max, min: 0 }),
      current: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
    });

    return {
      // Descriptor, Type, and Focus.
      descriptor: new StringField({ required: true, blank: true }),
      type: new StringField({ required: true, blank: true }),
      focus: new StringField({ required: true, blank: true }),

      // Determines which character fields are active and enables genre-specific data.
      genre: new StringField({ required: true, initial: "none", choices: CYPHER.genres }),

      // Optional species value. Some species grant a second descriptor, which is
      // enabled explicitly by the sheet.
      species: new StringField({ required: true, blank: true }),

      // Replaces Type/Focus for Real-World characters.
      profession: new StringField({ required: true, blank: true }),

      // Superhero rank (1-5) and power shifts.
      rank: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 5 }),
      powerShifts: new SchemaField(
        Object.fromEntries(CYPHER.powerShiftCategories.map(cat =>
          [cat, new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 3 })]
        ))
      ),

      // Optional second descriptor and focus, enabled explicitly when granted.
      hasSecondDescriptor: new BooleanField({ required: true, initial: false }),
      descriptor2: new StringField({ required: true, blank: true }),
      hasSecondFocus: new BooleanField({ required: true, initial: false }),
      focus2: new StringField({ required: true, blank: true }),

      tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
      effort: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      xp: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      // Resource Points gained through character advancement.
      resourcePoints: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      stats: new SchemaField({
        might: statSchema(),
        speed: statSchema(),
        intellect: statSchema()
      }),

      // Optional player-defined stats in addition to Might, Speed, and Intellect.
      customStats: new ArrayField(new SchemaField({
        id: new StringField({ required: true, blank: false }),
        label: new StringField({ required: true, blank: false }),
        pool: new SchemaField({
          max: new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
          value: new NumberField({ required: true, integer: true, initial: 8, min: 0 })
        }),
        edge: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }), { required: true, initial: [] }),

      // Three wound severities, each with its own track.
      wounds: new SchemaField({
        minor: woundSchema(CYPHER.defaultWoundMax.minor),
        moderate: woundSchema(CYPHER.defaultWoundMax.moderate),
        major: woundSchema(CYPHER.defaultWoundMax.major)
      }),

      // Active armor is derived from the equipped Armor item rather than
      // duplicated in the actor model. Only one Armor item may be equipped.

      recoveries: new SchemaField({
        // One checkbox for each daily recovery interval.
        action: new BooleanField({ initial: false }),
        tenMinutes: new BooleanField({ initial: false }),
        hour: new BooleanField({ initial: false }),
        tenHours: new BooleanField({ initial: false })
      }),

      // Maximum number of cyphers carried simultaneously.
      cypherLimit: new NumberField({ required: true, integer: true, initial: 2, min: 0 }),

      // Permanent bonus applied to recovery rolls.
      recoveryBonus: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Advancement-derived permission to use all armor or weapon categories freely.
      canFreelyUseAllArmor: new BooleanField({ required: true, initial: false }),
      canFreelyUseAllWeapons: new BooleanField({ required: true, initial: false }),

      // Four advancement slots for the current tier. Completing all four advances
      // the character to the next tier and resets the slots.
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

      // Player-defined text, number, or checkbox fields for data not covered by
      // the standard actor model.
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

  /**
   * Computes derived values used by the PC sheet.
   *
   * Errors are isolated so a failure in derived-data preparation does not
   * prevent the actor sheet from opening.
   */
  prepareDerivedData() {
    // Keep the sheet usable if derived-data preparation encounters an error.
    try {
      this._prepareDerivedDataUnsafe();
    } catch (err) {
      console.error("Cypher | Erreur lors du calcul des données dérivées du personnage :", err);
      this._applyDerivedDataFallback();
    }
  }

  /**
   * Computes derived values without the outer error guard.
   *
   * @private
   */
  _prepareDerivedDataUnsafe() {
    for (const stat of CYPHER.stats) {
      const s = this.stats[stat];
      s.depleted = s.pool.value <= 0;
    }
    for (const custom of this.customStats) {
      custom.depleted = custom.pool.value <= 0;
    }

    // Completing the moderate wound track adds one hindrance step; each major
    // wound adds another step. These penalties stack.
    const w = this.wounds;
    let hinderSteps = 0;
    if (w.moderate.current >= w.moderate.max && w.moderate.max > 0) hinderSteps += 1;
    hinderSteps += w.major.current;

    this.hindered = hinderSteps > 0;
    this.hinderSteps = hinderSteps;
    this.stepModifier = -hinderSteps;

    this.dead = w.major.current >= w.major.max && w.major.max > 0;

    // Genre-dependent derived values.
    this.isSuperhero = this.genre === "superhero";
    this.isRealWorld = this.genre === "realWorld";
    this.isCustomGenre = this.genre === "custom";
    this.usesTypeAndFocus = this.genre !== "realWorld";
    // The Custom genre exposes both the Real-World profession field and the
    // Superhero block in addition to the standard character fields.
    this.showProfession = this.isRealWorld || this.isCustomGenre;
    this.showSuperheroBlock = this.isSuperhero || this.isCustomGenre;
    this.maxDifficulty = this.isSuperhero ? CYPHER.maxDifficulty.superhero : CYPHER.maxDifficulty.standard;
    // Only Superhero characters can rally to remove a major wound.
    this.canRallyMajor = this.isSuperhero;

    this.powerShiftTotal = Object.values(this.powerShifts).reduce((sum, v) => sum + v, 0);

    // Derive active armor from the equipped inventory item. If the item collection
    // is not ready yet, fall back to no armor without throwing.
    let equippedArmorItem = null;
    const itemsCollection = this.parent?.items;
    if (itemsCollection && typeof itemsCollection.find === "function") {
      equippedArmorItem = itemsCollection.find(i => i?.type === "armor" && i?.system?.equipped === true) ?? null;
    }
    const category = equippedArmorItem?.system?.category ?? "none";
    const armorSteps = CYPHER.armorCategories[category] ?? { block: 0, dodge: 0 };
    const blockEaseDamage = equippedArmorItem?.system?.blockEaseDamage ?? 0;
    // Armor damage reduces the Block bonus but never changes Dodge hindrance.
    // Non-free armor applies its Dodge hindrance to all Speed tasks.
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

    // Current tier advancement slots.
    this.advancementBoughtCount = this.advancementSlots.filter(s => s.bought).length;
    this.advancementComplete = this.advancementBoughtCount >= 4;
  }

  /**
   * Applies minimal derived values when full preparation fails.
   *
   * The fallback keeps the sheet renderable without introducing unrelated
   * persistent state.
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
