import { CYPHER } from "../config.mjs";

/**
 * Data model for general equipment carried by an actor.
 *
 * Quantity and weight describe ordinary gear; optional depletion fields let
 * CypherItem handle limited-use equipment in the same way as artifacts.
 */
const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class CypherEquipmentData extends foundry.abstract.TypeDataModel {
  static migrateData(source) {
    if (source && source.depletionThreshold !== undefined) {
      const threshold = Number(source.depletionThreshold);
      source.depletionMin ??= threshold;
      source.depletionMax ??= threshold;
      delete source.depletionThreshold;
    }
    return super.migrateData ? super.migrateData(source) : source;
  }

  static defineSchema() {
    return {
      quantity: new NumberField({
        required: true, integer: true, initial: 1, min: 0
      }),
      // The CRD does not assign an object level to every equipment entry.
      level: new NumberField({
        required: true, integer: true, nullable: true, initial: null, min: 0
      }),
      priceCategory: new StringField({
        required: true, initial: "moderate", choices: CYPHER.priceCategories
      }),
      weight: new StringField({
        required: true,
        initial: "light",
        choices: ["none", "light", "medium", "heavy"]
      }),
      equipped: new BooleanField({ required: true, initial: false }),
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
