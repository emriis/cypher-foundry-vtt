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
      }, {
        required: true,
        initial: { max: 8, value: 8 }
      }),
      edge: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
    }, {
      required: true,
      initial: { pool: { max: 8, value: 8 }, edge: 0 }
    });

    // Defines the maximum and currently checked boxes for one wound severity.
    const woundSchema = (max) => new SchemaField({
      max: new NumberField({ required: true, integer: true, initial: max, min: 0 }),
      current: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
    });

    return {
      descriptor: new StringField({ required: true, blank: true }),
      type: new StringField({ required: true, blank: true }),
      focus: new StringField({ required: true, blank: true }),
      genre: new StringField({ required: true, initial: "none", choices: CYPHER.genres }),
      species: new StringField({ required: true, blank: true }),
      profession: new StringField({ required: true, blank: true }),
      rank: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 5 }),
      powerShifts: new SchemaField(
        Object.fromEntries(CYPHER.powerShiftCategories.map(cat =>
          [cat, new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 3 })]
        )),
        {
          required: true,
          initial: Object.fromEntries(
            CYPHER.powerShiftCategories.map(cat => [cat, 0])
          )
        }
      ),
      hasSecondDescriptor: new BooleanField({ required: true, initial: false }),
      descriptor2: new StringField({ required: true, blank: true }),
      hasSecondFocus: new BooleanField({ required: true, initial: false }),
      focus2: new StringField({ required: true, blank: true }),
      tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
      effort: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      xp: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      resourcePoints: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      stats: new SchemaField({
        might: statSchema(),
        speed: statSchema(),
        intellect: statSchema()
      }, {
        required: true,
        initial: {
          might: { pool: { max: 8, value: 8 }, edge: 0 },
          speed: { pool: { max: 8, value: 8 }, edge: 0 },
          intellect: { pool: { max: 8, value: 8 }, edge: 0 }
        }
      }),

      customStats: new ArrayField(new SchemaField({
        id: new StringField({ required: true, blank: false }),
        label: new StringField({ required: true, blank: false }),
        pool: new SchemaField({
          max: new NumberField({ required: true, integer: true, initial: 8, min: 0 }),
          value: new NumberField({ required: true, integer: true, initial: 8, min: 0 })
        }),
        edge: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }), { required: true, initial: [] }),

      wounds: new SchemaField({
        minor: woundSchema(CYPHER.defaultWoundMax.minor),
        moderate: woundSchema(CYPHER.defaultWoundMax.moderate),
        major: woundSchema(CYPHER.defaultWoundMax.major)
      }, {
        required: true,
        initial: {
          minor: { max: CYPHER.defaultWoundMax.minor, current: 0 },
          moderate: { max: CYPHER.defaultWoundMax.moderate, current: 0 },
          major: { max: CYPHER.defaultWoundMax.major, current: 0 }
        }
      }),

      recoveries: new SchemaField({
        action: new BooleanField({ initial: false }),
        tenMinutes: new BooleanField({ initial: false }),
        hour: new BooleanField({ initial: false }),
        tenHours: new BooleanField({ initial: false })
      }, {
        required: true,
        initial: {
          action: false,
          tenMinutes: false,
          hour: false,
          tenHours: false
        }
      }),

      activeAbilityEffects: new ArrayField(new SchemaField({
        itemUuid: new StringField({ required: true, blank: false }),
        effectId: new StringField({ required: true, blank: false })
      }), { required: true, initial: [] }),
      cypherLimit: new NumberField({ required: true, integer: true, initial: 2, min: 0 }),
      recoveryBonus: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      canFreelyUseAllArmor: new BooleanField({ required: true, initial: false }),
      canFreelyUseAllWeapons: new BooleanField({ required: true, initial: false }),
      freeWeaponCategories: new ArrayField(
        new StringField({ required: true, choices: CYPHER.weaponCategories }),
        { required: true, initial: [...CYPHER.coreFreeWeaponCategories] }
      ),
      freeArmorCategories: new ArrayField(
        new StringField({ required: true, choices: CYPHER.armorCategoryIds }),
        { required: true, initial: [...CYPHER.coreFreeArmorCategories] }
      ),
      freeWeaponFamilies: new ArrayField(
        new StringField({ required: true, choices: CYPHER.weaponFamilies }),
        { required: true, initial: [] }
      ),
      freeWeaponSkillCategories: new ArrayField(
        new StringField({ required: true, choices: CYPHER.attackSkillCategories }),
        { required: true, initial: [] }
      ),
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

  prepareDerivedData() {
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

    const w = this.wounds;
    let hinderSteps = 0;
    if (w.moderate.current >= w.moderate.max && w.moderate.max > 0) hinderSteps += 1;
    hinderSteps += w.major.current;

    this.hindered = hinderSteps > 0;
    this.hinderSteps = hinderSteps;
    this.stepModifier = -hinderSteps;
    this.dead = w.major.current >= w.major.max && w.major.max > 0;

    this.isSuperhero = this.genre === "superhero";
    this.isRealWorld = this.genre === "realWorld";
    this.isCustomGenre = this.genre === "custom";
    this.supportsSpecies = ["fantasy", "sciFi", "custom"].includes(this.genre);
    this.usesTypeAndFocus = this.genre !== "realWorld";
    this.showProfession = this.isRealWorld || this.isCustomGenre;
    this.showSuperheroBlock = this.isSuperhero || this.isCustomGenre;
    this.maxDifficulty = this.isSuperhero ? CYPHER.maxDifficulty.superhero : CYPHER.maxDifficulty.standard;
    this.canRallyMajor = this.isSuperhero;
    this.powerShiftTotal = Object.values(this.powerShifts).reduce((sum, v) => sum + v, 0);

    let equippedArmorItem = null;
    const itemsCollection = this.parent?.items;
    if (itemsCollection && typeof itemsCollection.find === "function") {
      equippedArmorItem = itemsCollection.find(i => i?.type === "armor" && i?.system?.equipped === true) ?? null;
    }
    const category = equippedArmorItem?.system?.category ?? "none";
    const armorSteps = CYPHER.armorCategories[category] ?? { block: 0, dodge: 0 };
    const encumbranceCategory = equippedArmorItem?.system?.encumbranceCategory || category;
    const encumbranceSteps = CYPHER.armorCategories[encumbranceCategory] ?? { block: 0, dodge: 0 };
    const blockEaseDamage = equippedArmorItem?.system?.blockEaseDamage ?? 0;
    const freeArmorCategories = this.freeArmorCategories ?? CYPHER.coreFreeArmorCategories;
    const freelyUsable = (equippedArmorItem?.system?.freelyUsable ?? false)
      || this.canFreelyUseAllArmor
      || freeArmorCategories.includes(category);

    this.armor = {
      itemId: equippedArmorItem?.id ?? null,
      name: equippedArmorItem?.name ?? null,
      category,
      freelyUsable,
      baseBlockEase: armorSteps.block,
      blockEaseDamage,
      blockEase: Math.max(0, armorSteps.block - blockEaseDamage),
      damaged: blockEaseDamage > 0,
      dodgeHinder: equippedArmorItem?.system?.dodgeHindrance ?? encumbranceSteps.dodge,
      speedTaskHinder: freelyUsable ? 0 :
        (equippedArmorItem?.system?.dodgeHindrance ?? encumbranceSteps.dodge)
    };

    this.advancementBoughtCount = this.advancementSlots.filter(s => s.bought).length;
    this.advancementComplete = this.advancementBoughtCount >= 4;
  }

  _applyDerivedDataFallback() {
    this.hindered ??= false;
    this.hinderSteps ??= 0;
    this.stepModifier ??= 0;
    this.dead ??= false;
    this.isSuperhero ??= false;
    this.isRealWorld ??= false;
    this.isCustomGenre ??= false;
    this.supportsSpecies ??= false;
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
