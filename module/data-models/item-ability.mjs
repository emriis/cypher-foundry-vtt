const { StringField, NumberField, HTMLField, BooleanField, SchemaField } = foundry.data.fields;

export default class CypherAbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      source: new StringField({ required: true, blank: true }), // ex: "Type", "Focus", "Advancement"
      tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
      enabler: new BooleanField({ required: true, initial: false }), // capacité passive/activable

      cost: new SchemaField({
        stat: new StringField({ required: true, initial: "none", choices: ["might", "speed", "intellect", "none"] }),
        amount: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }),

      action: new StringField({ required: true, initial: "none", choices: ["action", "movement", "none"] }),

      description: new HTMLField({ required: true, blank: true })
    };
  }
}
