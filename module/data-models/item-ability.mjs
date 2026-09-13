/**
 * Data model for a Cypher ability item.
 *
 * Abilities can originate from a character's Type, Focus, or advancement and
 * may be passive enablers or actions with an optional Pool cost.
 */
const { StringField, NumberField, HTMLField, BooleanField, SchemaField } = foundry.data.fields;

export default class CypherAbilityData extends foundry.abstract.TypeDataModel {
  /**
   * Defines the persisted schema for an ability item.
   *
   * @returns {object} Foundry data field definitions.
   */
  static defineSchema() {
    return {
      source: new StringField({ required: true, blank: true }),
      tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
      enabler: new BooleanField({ required: true, initial: false }),

      cost: new SchemaField({
        stat: new StringField({ required: true, initial: "none", choices: ["might", "speed", "intellect", "none"] }),
        amount: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }),

      action: new StringField({ required: true, initial: "none", choices: ["action", "movement", "none"] }),

      description: new HTMLField({ required: true, blank: true })
    };
  }
}
