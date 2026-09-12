import { CYPHER } from "../config.mjs";

const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class CypherEquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: new NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      weight: new StringField({ required: true, initial: "light", choices: ["none", "light", "medium", "heavy"] }),
      equipped: new BooleanField({ required: true, initial: false }),

      // Certains équipements (trousse de secours, aspirine...) utilisent un épuisement au lieu
      // d'une quantité fixe, comme dans le CRD. "none" = pas d'épuisement (comportement par défaut).
      // Some equipment (medical bag, aspirin...) uses depletion instead of a fixed quantity,
      // as in the CRD. "none" = no depletion (default behavior).
      depletionDie: new StringField({ required: true, initial: "none", choices: ["none", ...CYPHER.depletionDice] }),
      depletionThreshold: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      depleted: new BooleanField({ required: true, initial: false }),

      description: new HTMLField({ required: true, blank: true })
    };
  }
}
