import { CYPHER } from "../config.mjs";

import { CYPHER } from "../config.mjs";

const { StringField, NumberField, HTMLField, ArrayField, BooleanField, SchemaField } = foundry.data.fields;

/**
 * Data model for a Focus compendium entry and its ability flowchart.
 *
 * The actor stores chosen ability IDs; prerequisite links here tell the actor
 * document and sheet which ability can be selected next.
 */
/**
 * Data model for a Focus compendium entry and its ability flowchart.
 *
 * The actor stores chosen ability IDs; prerequisite links here tell the actor
 * document and sheet which ability can be selected next.
 */
export default class CypherFocusData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      abilities: new ArrayField(new SchemaField({
        id: new StringField({ required: true, blank: false }),
        name: new StringField({ required: true, blank: false }),
        tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
        prerequisites: new ArrayField(new StringField({ required: true, blank: false }), { required: true, initial: [] }),
        repeatable: new BooleanField({ required: true, initial: false }),
        enabler: new BooleanField({ required: true, initial: false }),
        cost: new SchemaField({
          stat: new StringField({ required: true, initial: "none", choices: ["might", "speed", "intellect", "choice", "none"] }),
          amount: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
          options: new ArrayField(
            new StringField({ required: true, choices: ["might", "speed", "intellect"] }),
            { required: true, initial: [] }
          )
        }),
        freeWeaponCategories: new ArrayField(
          new StringField({ required: true, choices: CYPHER.weaponCategories }),
          { required: true, initial: [] }
        ),
        freeArmorCategories: new ArrayField(
          new StringField({ required: true, choices: CYPHER.armorCategoryIds }),
          { required: true, initial: [] }
        ),
        freeWeaponFamilies: new ArrayField(
          new StringField({ required: true, choices: CYPHER.weaponFamilies }),
          { required: true, initial: [] }
        ),
        freeWeaponSkillCategories: new ArrayField(
          new StringField({ required: true, choices: CYPHER.attackSkillCategories }),
          { required: true, initial: [] }
        ),
        chooseWeaponAttackCategory: new BooleanField({ required: true, initial: false }),
        grantedArmorItemCategory: new StringField({ required: true, initial: "", blank: true, choices: ["", ...CYPHER.armorCategoryIds] }),
        description: new HTMLField({ required: true, blank: true })
      }), { required: true, initial: [] }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}