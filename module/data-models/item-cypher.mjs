/**
 * Data model for a Cypher item carried by an actor.
 *
 * These fields record whether the item can still be used; the item document
 * handles the use action and its chat message.
 */
const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class CypherCypherData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cypherType: new StringField({ required: true, initial: "manifest", choices: ["subtle", "manifest"] }),
      level: new StringField({ required: true, blank: true }),
      powerLevel: new StringField({ required: true, initial: "", choices: ["", "low", "medium", "advanced", "high", "ultra"] }),
      internal: new BooleanField({ required: true, initial: false }), // Marks a cypher implanted inside the character.
      identified: new BooleanField({ required: true, initial: true }),
      depleted: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
