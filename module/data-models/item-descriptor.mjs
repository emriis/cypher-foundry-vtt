const { StringField, NumberField, HTMLField, ArrayField, BooleanField, SchemaField } = foundry.data.fields;

/**
 * Data model for a Descriptor compendium entry.
 *
 * A Descriptor is a one-time package of actor benefits, not an item that stays
 * on the actor. Dragging it to a PC sheet calls CypherActor#applyDescriptor;
 * the actor keeps the granted Pool bonus, descriptor name, and Skill item.
 */
export default class CypherDescriptorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      category: new StringField({ required: true, initial: "descriptor", choices: ["descriptor", "species"] }),
      genres: new ArrayField(
        new StringField({ required: true, choices: ["fantasy", "sciFi"] }),
        { required: true, initial: [] }
      ),
      grantsSecondDescriptor: new BooleanField({ required: true, initial: false }),
      // With one available stat, the player does not need to choose when applying the Descriptor.
      statOptions: new ArrayField(
        new StringField({ required: true, choices: ["might", "speed", "intellect"] }),
        { required: true, initial: ["intellect"] }
      ),
      statAmount: new NumberField({ required: true, integer: true, initial: 2, min: 0 }),

      // The sheet adds an "Other (specify)" choice; blank slots are filtered out when the
      // actor applies the Descriptor, so editors can keep unused form rows empty.
      skillOptions: new ArrayField(new StringField({ required: true, blank: true }), { required: true, initial: [] }),

      // Fixed trained skills granted in addition to an optional skill choice. This supports
      // species such as Naron, which grant one chosen skill and one fixed trained skill.
      grantedSkills: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),

      benefits: new ArrayField(new SchemaField({
        name: new StringField({ required: true, blank: false }),
        description: new HTMLField({ required: true, blank: false })
      }), { required: true, initial: [] }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
