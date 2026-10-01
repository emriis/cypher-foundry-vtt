import { CYPHER } from "../config.mjs";

/**
 * Data model for an Artifact item.
 *
 * The schema stores its description and structured depletion settings, which
 * CypherItem can use to automate depletion rolls.
 */
const { StringField, HTMLField, BooleanField, NumberField } = foundry.data.fields;

export default class CypherArtifactData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      level: new StringField({ required: true, blank: true }),
      form: new StringField({ required: true, blank: true }),
      identified: new BooleanField({ required: true, initial: true }),
      // Depletion is structured (not free text) to allow the automated roll:
      // "1 in 1d20" → depletionDie: "d20", depletionThreshold: 1. "—" (never depletes) → "none".
      depletionDie: new StringField({ required: true, initial: "d20", choices: ["none", ...CYPHER.depletionDice] }),
      depletionThreshold: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      depleted: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
