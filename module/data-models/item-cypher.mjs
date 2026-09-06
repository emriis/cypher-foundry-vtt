const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class CypherCypherData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cypherType: new StringField({ required: true, initial: "manifest", choices: ["subtle", "manifest"] }),
      level: new StringField({ required: true, blank: true }), // ex: "1d6+2"
      internal: new BooleanField({ required: true, initial: false }), // implanté / internal cypher
      identified: new BooleanField({ required: true, initial: true }),
      depleted: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
