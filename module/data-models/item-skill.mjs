import { CYPHER } from "../config.mjs";

const { StringField, HTMLField } = foundry.data.fields;

export default class CypherSkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      stat: new StringField({ required: true, initial: "might", choices: ["might", "speed", "intellect", "none"] }),
      level: new StringField({
        required: true,
        initial: "trained",
        choices: Object.keys(CYPHER.skillLevels) // inability, none, trained, specialized, expert
      }),
      description: new HTMLField({ required: true, blank: true })
    };
  }

  get stepModifier() {
    return CYPHER.skillLevels[this.level] ?? 0;
  }
}
