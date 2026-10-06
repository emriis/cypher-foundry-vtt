import { CYPHER } from "../config.mjs";

const {
  StringField,
  NumberField,
  HTMLField,
  BooleanField,
  ArrayField,
  SchemaField
} = foundry.data.fields;

/**
 * Structured weapon mechanics that can be consumed by automation.
 *
 * The legacy properties array remains the source-facing descriptive text.
 * These fields encode only mechanics explicitly represented by the CRD and
 * therefore must not be inferred from arbitrary prose.
 */
function createWeaponMechanicsField() {
  return new SchemaField({
    twoHanded: new BooleanField({ required: true, initial: false }),
    rapidFire: new BooleanField({ required: true, initial: false }),
    ignoresPhysicalArmor: new NumberField({
      required: true, integer: true, initial: 0, min: 0
    }),
    cutsThroughMaterialsLevel: new NumberField({
      required: true, nullable: true, initial: null, integer: true, min: 0
    }),
    targetEffects: new ArrayField(new SchemaField({
      minimumTargetLevel: new NumberField({
        required: true, integer: true, initial: 0, min: 0
      }),
      maximumTargetLevel: new NumberField({
        required: true, nullable: true, initial: null, integer: true, min: 0
      }),
      effect: new StringField({
        required: true,
        initial: "",
        choices: ["", "loseNextAction", "hindered"]
      }),
      hinderSteps: new NumberField({
        required: true, integer: true, initial: 0, min: 0
      }),
      duration: new StringField({ required: true, initial: "" })
    }), { required: true, initial: [] }),
    requiresTripod: new BooleanField({ required: true, initial: false }),
    requiredOperators: new NumberField({
      required: true, integer: true, initial: 0, min: 0
    }),
    alternateConfiguration: new SchemaField({
      enabled: new BooleanField({ required: true, initial: false }),
      attackType: new StringField({
        required: true,
        initial: "",
        choices: ["", "light", "medium", "heavy"]
      }),
      action: new StringField({
        required: true,
        initial: "",
        choices: ["", "action"]
      })
    })
  });
}

/**
 * Data model for a weapon or other attack item.
 *
 * CypherItem and CypherActor use these fields when the player starts an attack
 * from the character sheet.
 */
export default class CypherAttackData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      attackType: new StringField({
        required: true,
        initial: "light",
        choices: ["light", "medium", "heavy"]
      }),
      range: new StringField({
        required: true, initial: "immediate", choices: CYPHER.rangeCategories
      }),
      extremeRange: new StringField({
        required: true, initial: "", choices: ["", ...CYPHER.rangeCategories]
      }),
      damage: new NumberField({
        required: true, integer: true, initial: 2, min: 0
      }),
      stat: new StringField({
        required: true, initial: "might", choices: ["might", "speed"]
      }),
      weaponFamily: new StringField({
        required: true,
        initial: "",
        choices: ["", ...CYPHER.weaponFamilies]
      }),
      attackSkillCategory: new StringField({
        required: true,
        initial: "",
        choices: ["", ...CYPHER.attackSkillCategories]
      }),
      priceCategory: new StringField({
        required: true, initial: "expensive", choices: CYPHER.priceCategories
      }),
      properties: new ArrayField(
        new StringField({ required: true, blank: false }),
        { required: true, initial: [] }
      ),
      mechanics: createWeaponMechanicsField(),
      // Can the character use this weapon without penalty (determined by
      // their Type or by the "Other: Weapons" advancement)?
      freelyUsable: new BooleanField({ required: true, initial: false }),
      equipped: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
