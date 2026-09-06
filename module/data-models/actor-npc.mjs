const { SchemaField, NumberField, StringField, HTMLField } = foundry.data.fields;

export default class CypherNPCData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      level: new NumberField({ required: true, integer: true, initial: 3, min: 1 }),
      health: new SchemaField({
        max: new NumberField({ required: true, integer: true, initial: 10, min: 0 }),
        value: new NumberField({ required: true, integer: true, initial: 10, min: 0 })
      }),
      armor: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      damage: new StringField({ required: true, blank: true, initial: "" }), // ex: "4" or "2d6"
      movement: new StringField({ required: true, blank: true }),
      modifications: new StringField({ required: true, blank: true }), // ex: "attacks as level 5"
      combat: new HTMLField({ required: true, blank: true }),
      interaction: new HTMLField({ required: true, blank: true }),
      use: new HTMLField({ required: true, blank: true }),
      loot: new HTMLField({ required: true, blank: true }),
      gmNotes: new HTMLField({ required: true, blank: true })
    };
  }

  get targetNumber() {
    return this.level * 3;
  }
}
