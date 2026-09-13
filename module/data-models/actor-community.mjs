/**
 * Data model for a Cypher Community actor.
 *
 * Communities represent shared groups, organizations, settlements, or other
 * collective entities that need a lightweight actor representation.
 */
const { NumberField, HTMLField } = foundry.data.fields;

export default class CypherCommunityData extends foundry.abstract.TypeDataModel {
  /**
   * Defines the persisted schema for a Community actor.
   *
   * @returns {object} Foundry data field definitions.
   */
  static defineSchema() {
    return {
      tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
      description: new HTMLField({ required: true, blank: true }),
      resources: new HTMLField({ required: true, blank: true }),
      notes: new HTMLField({ required: true, blank: true })
    };
  }
}
