import { CYPHER } from "../config.mjs";

const { StringField, HTMLField, BooleanField, NumberField } = foundry.data.fields;

export default class CypherArtifactData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      level: new StringField({ required: true, blank: true }),
      form: new StringField({ required: true, blank: true }),
      identified: new BooleanField({ required: true, initial: true }),
      // L'épuisement est structuré (pas un simple texte) pour permettre le jet automatique :
      // "1 en 1d20" → depletionDie: "d20", depletionThreshold: 1. "—" (n'épuise jamais) → "none".
      // Depletion is structured (not free text) to allow the automated roll:
      // "1 in 1d20" → depletionDie: "d20", depletionThreshold: 1. "—" (never depletes) → "none".
      depletionDie: new StringField({ required: true, initial: "d20", choices: ["none", ...CYPHER.depletionDice] }),
      depletionThreshold: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      depleted: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
