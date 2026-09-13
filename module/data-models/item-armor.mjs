/**
 * Data model for a Cypher armor item.
 *
 * Armor affects defensive task difficulty and may also impose a Speed
 * hindrance when the character cannot freely use its category.
 */
const { StringField, HTMLField, BooleanField, NumberField } = foundry.data.fields;

export default class CypherArmorData extends foundry.abstract.TypeDataModel {
  /**
   * Defines the persisted schema for an armor item.
   *
   * @returns {object} Foundry data field definitions.
   */
  static defineSchema() {
    return {
      category: new StringField({ required: true, initial: "light", choices: ["light", "medium", "heavy"] }),
      freelyUsable: new BooleanField({ required: true, initial: false }),
      equipped: new BooleanField({ required: true, initial: false }),
      blockEaseDamage: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
