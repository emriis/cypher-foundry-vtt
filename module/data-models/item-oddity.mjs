const { HTMLField } = foundry.data.fields;

/**
 * Data model for an Oddity item.
 *
 * An Oddity has descriptive text but no automated game fields; the shared
 * item sheet stores and displays that text.
 */
export default class CypherOddityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
