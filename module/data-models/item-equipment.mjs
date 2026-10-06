import { CYPHER } from "../config.mjs";

/**
 * Data model for general equipment carried by an actor.
 *
 * Quantity and weight describe ordinary gear; optional depletion fields let
 * CypherItem handle limited-use equipment in the same way as artifacts.
 */
const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class CypherEquipmentData extends foundry.abstract.TypeDataModel {
  static migrateData(source) {\n    if (source && source.depletionThreshold !== undefined) {\n      const threshold = Number(source.depletionThreshold);\n      source.depletionMin ??= threshold;\n      source.depletionMax ??= threshold;\n      delete source.depletionThreshold;\n    }\n    return super.migrateData ? super.migrateData(source) : source;\n  }\n\n  static defineSchema() {
    return {
      quantity: new NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      level: new NumberField({ required: true, integer: true, nullable: true, initial: 4, min: 0 }),
      priceCategory: new StringField({ required: true, initial: "moderate", choices: CYPHER.priceCategories }),
      weight: new StringField({ required: true, initial: "light", choices: ["none", "light", "medium", "heavy"] }),
      equipped: new BooleanField({ required: true, initial: false }),

      // Some equipment (medical bag, aspirin...) uses depletion instead of a fixed quantity,
      // as in the CRD. "none" = no depletion (default behavior).
      depletionDie: new StringField({ required: true, initial: "none", choices: ["none", ...CYPHER.depletionDice] }),
      depletionMin: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      depletionMax: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      depleted: new BooleanField({ required: true, initial: false }),

      description: new HTMLField({ required: true, blank: true })
    };
  }
}
