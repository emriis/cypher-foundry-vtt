/**
 * Data model for a Cypher armor item.
 *
 * Armor affects defensive task difficulty and may also impose a Speed
 * hindrance when the character cannot freely use its category.
 */
import { CYPHER } from "../config.mjs";

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
      // Null means the armor uses its normal category for dodge hindrance.
      // Some CRD armor explicitly encumbers as a lighter category.
      encumbranceCategory: new StringField({
        required: true,
        nullable: true,
        initial: null,
        choices: ["", "light", "medium", "heavy"]
      }),
      // Null means the normal dodge hindrance is derived from the armor
      // category or explicit encumbrance category. Zero represents a CRD
      // exception such as spray-on impact armor, which hinders no dodge tasks.
      dodgeHindrance: new NumberField({
        required: true,
        nullable: true,
        initial: null,
        integer: true,
        min: 0
      }),
      freelyUsable: new BooleanField({ required: true, initial: false }),
      equipped: new BooleanField({ required: true, initial: false }),
      blockEaseDamage: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      priceCategory: new StringField({
        required: true, initial: "expensive", choices: CYPHER.priceCategories
      }),
      depletionDie: new StringField({
        required: true,
        initial: "none",
        choices: ["none", ...CYPHER.depletionDice]
      }),
      depletionMin: new NumberField({
        required: true, integer: true, initial: 1, min: 1
      }),
      depletionMax: new NumberField({
        required: true, integer: true, initial: 1, min: 1
      }),
      depleted: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
