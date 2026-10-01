import { CYPHER } from "../config.mjs";

/**
 * Data model for a shield and its independent wound track.
 *
 * CypherActor updates this track when a successful Block transfers a wound
 * from the character to an equipped, unbroken shield.
 */
const { SchemaField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class CypherShieldData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const woundSchema = (max) => new SchemaField({
      max: new NumberField({ required: true, integer: true, initial: max, min: 0 }),
      current: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
    });

    return {
      // Any character can use a shield freely, regardless of their Type
      equipped: new BooleanField({ required: true, initial: false }),

      // A shield has its own wound track: 3 minor, 2 moderate, 1 major by default
      wounds: new SchemaField({
        minor: woundSchema(CYPHER.defaultShieldWoundMax.minor),
        moderate: woundSchema(CYPHER.defaultShieldWoundMax.moderate),
        major: woundSchema(CYPHER.defaultShieldWoundMax.major)
      }),

      description: new HTMLField({ required: true, blank: true })
    };
  }

  prepareDerivedData() {
    // The shield is destroyed as soon as it takes a major wound
    this.broken = this.wounds.major.current >= this.wounds.major.max && this.wounds.major.max > 0;
  }
}
