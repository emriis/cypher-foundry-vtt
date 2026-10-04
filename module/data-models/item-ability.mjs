import { createAbilityEffectsField, createAbilityRollTablesField } from "./ability-fields.mjs";

const { StringField, NumberField, HTMLField, BooleanField, ArrayField, SchemaField } = foundry.data.fields;

/**
 * Data model for a standalone Cypher ability Item.
 *
 * An ability owns its intrinsic mechanics so it can be reused by Types,
 * Foci, advancement, and custom content.
 */
export default class CypherAbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier: new NumberField({
        required: true, integer: true, initial: 1, min: 1, max: 6
      }),
      key: new StringField({ required: true, blank: false }),
      enabler: new BooleanField({ required: true, initial: false }),
      repeatable: new BooleanField({ required: true, initial: false }),

      cost: new SchemaField({
        stat: new StringField({
          required: true,
          initial: "none",
          choices: ["might", "speed", "intellect", "choice", "none"]
        }),
        amount: new NumberField({
          required: true, integer: true, initial: 0, min: 0
        }),
        options: new ArrayField(
          new StringField({
            required: true,
            choices: ["might", "speed", "intellect"]
          }),
          { required: true, initial: [] }
        )
      }),

      // Null is reserved for activation cases that are not modelled by the
      // current Action/First Action/Last Action categories.
      action: new StringField({
        required: true,
        nullable: true,
        initial: null,
        choices: ["action", "firstAction", "lastAction"]
      }),

      freeWeaponCategories: new ArrayField(
        new StringField({ required: true }),
        { required: true, initial: [] }
      ),
      freeArmorCategories: new ArrayField(
        new StringField({ required: true }),
        { required: true, initial: [] }
      ),
      freeWeaponFamilies: new ArrayField(
        new StringField({ required: true }),
        { required: true, initial: [] }
      ),
      freeWeaponSkillCategories: new ArrayField(
        new StringField({ required: true }),
        { required: true, initial: [] }
      ),
      chooseWeaponAttackCategory: new BooleanField({
        required: true, initial: false
      }),
      grantedArmorItemCategory: new StringField({
        required: true, initial: "", blank: true
      }),

      effects: createAbilityEffectsField(),
      rollTables: createAbilityRollTablesField(),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
