/**
 * Data model for a Cypher non-player character (NPC).
 *
 * NPCs use a compact stat block rather than the full player-character model.
 */
const { SchemaField, NumberField, StringField, HTMLField } = foundry.data.fields;

export default class CypherNPCData extends foundry.abstract.TypeDataModel {
  /**
   * Defines the persisted schema for an NPC actor.
   *
   * @returns {object} Foundry data field definitions.
   */
  static defineSchema() {
    return {
      level: new NumberField({ required: true, integer: true, initial: 3, min: 1 }),
      health: new SchemaField({
        // A level-3 NPC defaults to its target number (level × 3); explicit
        // creature entries can override either health value.
        max: new NumberField({ required: true, integer: true, initial: 9, min: 0 }),
        value: new NumberField({ required: true, integer: true, initial: 9, min: 0 })
      }),
      description: new HTMLField({ required: true, blank: true, initial: "" }),
      motive: new StringField({ required: true, blank: true, initial: "" }),
      environment: new StringField({ required: true, blank: true, initial: "" }),
      armor: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      damage: new StringField({ required: true, blank: true, initial: "" }),
      movement: new StringField({ required: true, blank: true }),
      modifications: new StringField({ required: true, blank: true }),
      combat: new HTMLField({ required: true, blank: true }),
      interaction: new HTMLField({ required: true, blank: true }),
      use: new HTMLField({ required: true, blank: true }),
      loot: new HTMLField({ required: true, blank: true }),
      gmIntrusion: new HTMLField({ required: true, blank: true, initial: "" }),
      gmNotes: new HTMLField({ required: true, blank: true })
    };
  }

  /**
   * Gets the task target number derived from the NPC's level.
   *
   * @returns {number} The target number used for level-based NPC tasks.
   */
  get targetNumber() {
    return this.level * 3;
  }
}
