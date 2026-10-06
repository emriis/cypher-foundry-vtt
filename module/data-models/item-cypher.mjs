/**
 * Data model for a Cypher item carried by an actor.
 *
 * These fields record whether the item can still be used; the item document
 * handles the use action and its chat message.
 */
const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class CypherCypherData extends foundry.abstract.TypeDataModel {
  /**
   * Normalize the legacy textual level before Foundry validates the schema.
   * Empty legacy values represent a cypher with no explicit level.
   *
   * @param {object} source Raw persisted item data.
   * @returns {object} Migrated data.
   */
  static migrateData(source) {
    if (source && source.level !== undefined) {
      if (source.level === "") {
        source.level = null;
      } else if (typeof source.level === "string") {
        const level = Number(source.level);
        if (Number.isFinite(level)) source.level = level;
      }
    }
    return super.migrateData ? super.migrateData(source) : source;
  }

  static defineSchema() {
    return {
      cypherType: new StringField({ required: true, initial: "manifest", choices: ["subtle", "manifest"] }),
      // Manifest cyphers are level 6 effects in the CRD. Other cyphers may
      // have no explicit level, so level is nullable rather than defaulting to 6.
      level: new NumberField({ required: true, nullable: true, initial: null, integer: true, min: 0 }),
      // Power level (low through ultra) is a separate CRD classification and
      // must never be collapsed into the numeric effect level above.
      powerLevel: new StringField({ required: true, initial: "", choices: ["", "low", "medium", "advanced", "high", "ultra"] }),
      internal: new BooleanField({ required: true, initial: false }), // Marks a cypher implanted inside the character.
      identified: new BooleanField({ required: true, initial: true }),
      depleted: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
