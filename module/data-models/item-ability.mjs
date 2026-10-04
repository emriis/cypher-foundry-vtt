import { createAbilityEffectsField, createAbilityRollTablesField } from "./ability-fields.mjs";

const {
  StringField,
  NumberField,
  HTMLField,
  BooleanField,
  ArrayField,
  SchemaField
} = foundry.data.fields;

/**
 * Standalone ability data.
 *
 * Types and Foci reference these Items by UUID instead of embedding copies.
 */
export default class CypherAbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      key: new StringField({ required: true, blank: false }),
      tier: new NumberField({
        required: true,
        integer: true,
        initial: 1,
        min: 1,
        max: 6
      }),
      enabler: new BooleanField({ required: true, initial: false }),
      repeatable: new BooleanField({ required: true, initial: false }),
      cost: new SchemaField({
        stat: new StringField({
          required: true,
          initial: "none",
          choices: ["might", "speed", "intellect", "choice", "none"]
        }),
        amount: new NumberField({
          required: true,
          integer: true,
          initial: 0,
          min: 0
        }),
        options: new ArrayField(
          new StringField({
            required: true,
            choices: ["might", "speed", "intellect"]
          }),
          { required: true, initial: [] }
        )
      }),
      action: new StringField({
        required: true,
        nullable: true,
        initial: null,
        choices: ["", "action", "firstAction", "lastAction"]
      }),
      source: new StringField({ required: true, blank: true }),
      freeWeaponCategories: new ArrayField(new StringField({
        required: true,
        choices: ["light", "medium", "heavy"]
      }), { required: true, initial: [] }),
      freeArmorCategories: new ArrayField(new StringField({
        required: true,
        choices: ["light", "medium", "heavy"]
      }), { required: true, initial: [] }),
      freeWeaponFamilies: new ArrayField(
        new StringField({ required: true, blank: false }),
        { required: true, initial: [] }
      ),
      freeWeaponSkillCategories: new ArrayField(
        new StringField({ required: true, blank: false }),
        { required: true, initial: [] }
      ),
      chooseWeaponAttackCategory: new BooleanField({
        required: true,
        initial: false
      }),
      grantedArmorItemCategory: new StringField({
        required: true,
        initial: "",
        blank: true
      }),
      effects: createAbilityEffectsField(),
      rollTables: createAbilityRollTablesField(),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
