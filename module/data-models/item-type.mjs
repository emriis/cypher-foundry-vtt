import { CYPHER } from "../config.mjs";
import { createAbilityEffectsField, createAbilityRollTablesField } from "./ability-fields.mjs";

const { StringField, NumberField, HTMLField, ArrayField, BooleanField, SchemaField } = foundry.data.fields;

export default class CypherTypeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
      genre: new StringField({ required: true, initial: "Fantasy" }),
      subgenre: new StringField({ required: true, initial: "" }),
      poolBonuses: new SchemaField({
        might: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        speed: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        intellect: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }),
      edgeChoice: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      woundBonuses: new SchemaField({
        minor: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        moderate: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        major: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }),
      freeWeapons: new BooleanField({ required: true, initial: false }),
      freeArmor: new BooleanField({ required: true, initial: false }),
      freeWeaponCategories: new ArrayField(
        new StringField({ required: true, choices: CYPHER.weaponCategories }),
        { required: true, initial: [] }
      ),
      freeArmorCategories: new ArrayField(
        new StringField({ required: true, choices: CYPHER.armorCategoryIds }),
        { required: true, initial: [] }
      ),
      freeWeaponFamilies: new ArrayField(
        new StringField({ required: true, choices: CYPHER.weaponFamilies }),
        { required: true, initial: [] }
      ),
      skillOptions: new ArrayField(new StringField({ required: true, blank: true }), { required: true, initial: [] }),
      abilities: new ArrayField(new SchemaField({
        id: new StringField({ required: true, blank: false }),
        name: new StringField({ required: true, blank: false }),
        tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
        prerequisites: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
        repeatable: new BooleanField({ required: true, initial: false }),
        enabler: new BooleanField({ required: true, initial: false }),
        cost: new SchemaField({
          stat: new StringField({ required: true, initial: "none", choices: ["might", "speed", "intellect", "choice", "none"] }),
          amount: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
          options: new ArrayField(
            new StringField({ required: true, choices: ["might", "speed", "intellect"] }),
            { required: true, initial: [] }
          )
        }),
        description: new HTMLField({ required: true, blank: true }),
        effects: createAbilityEffectsField(),
        rollTables: createAbilityRollTablesField()
      }), { required: true, initial: [] }),
      statOptions: new ArrayField(
        new StringField({ required: true, choices: ["might", "speed", "intellect"] }),
        { required: true, initial: [] }
      ),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
