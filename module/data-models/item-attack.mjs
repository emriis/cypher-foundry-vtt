import { CYPHER } from "../config.mjs";

/**
 * Data model for a weapon or other attack item.
 *
 * CypherItem and CypherActor use these fields when the player starts an attack
 * from the character sheet.
 */
const { StringField, NumberField, HTMLField, BooleanField, ArrayField } = foundry.data.fields;

export default class CypherAttackData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      attackType: new StringField({ required: true, initial: "light", choices: ["light", "medium", "heavy"] }),
      range: new StringField({
        required: true, initial: "immediate", choices: CYPHER.rangeCategories
      }),
      extremeRange: new StringField({
        required: true, initial: "", choices: ["", ...CYPHER.rangeCategories]
      }),
      damage: new NumberField({ required: true, integer: true, initial: 2, min: 0 }),
      stat: new StringField({ required: true, initial: "might", choices: ["might", "speed"] }),
      weaponFamily: new StringField({ required: true, initial: "", choices: ["", ...CYPHER.weaponFamilies] }),
      attackSkillCategory: new StringField({ required: true, initial: "", choices: ["", ...CYPHER.attackSkillCategories] }),
      priceCategory: new StringField({
        required: true, initial: "expensive", choices: CYPHER.priceCategories
      }),
      properties: new ArrayField(
        new StringField({ required: true, blank: false }),
        { required: true, initial: [] }
      ),
      // Can the character use this weapon without penalty? (determined by their Type, or by
      // the "Other: Weapons" advancement). Unchecked by default for Real World medium/heavy weapons.
      freelyUsable: new BooleanField({ required: true, initial: false }),
      equipped: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
