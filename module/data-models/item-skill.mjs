import { CYPHER } from "../config.mjs";

/**
 * Data model for a skill item.
 *
 * Its training level becomes a step modifier during an actor task roll, while
 * the linked stat tells the sheet which pool the skill normally uses.
 */
const { StringField, HTMLField } = foundry.data.fields;

export default class CypherSkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      stat: new StringField({ required: true, initial: "might", choices: ["might", "speed", "intellect", "none"] }),
      level: new StringField({
        required: true,
        initial: "trained",
        choices: Object.keys(CYPHER.skillLevels) // inability, practiced, trained, specialized, expert
      }),
      description: new HTMLField({ required: true, blank: true })
    };
  }

  get stepModifier() {
    return CYPHER.skillLevels[this.level] ?? 0;
  }
}
