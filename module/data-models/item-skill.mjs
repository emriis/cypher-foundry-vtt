import { CYPHER } from "../config.mjs";

/**
 * Data model for a skill item.
 *
 * Its training level becomes a step modifier during an actor task roll, while
 * the linked stat tells the sheet which pool the skill normally uses.
 */
const { StringField, NumberField, HTMLField } = foundry.data.fields;

export default class CypherSkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      stat: new StringField({ required: true, initial: "might", choices: ["might", "speed", "intellect", "none"] }),
      level: new StringField({
        required: true,
        initial: "trained",
        choices: Object.keys(CYPHER.skillLevels) // inability, practiced, trained, specialized, expert
      }),
      attackCategory: new StringField({ required: true, blank: true, initial: "", choices: ["", ...CYPHER.attackSkillCategories] }),
      minimumTier: new NumberField({
        required: true, integer: true, nullable: true, initial: null, min: 1, max: 6
      }),
      minimumSpecializationTier: new NumberField({
        required: true, integer: true, nullable: true, initial: null, min: 1, max: 6
      }),
      description: new HTMLField({ required: true, blank: true })
    };
  }

  get stepModifier() {
    return CYPHER.skillLevels[this.level] ?? 0;
  }
}
