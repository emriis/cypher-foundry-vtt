/**
 * Data model for a Cypher item carried by an actor.
 *
 * The model preserves CRD-level distinctions between effect level, manifest
 * power classification, random-generation ranges, and multi-power variants.
 */
import {
  createCypherPowerVariantsField,
  createCypherRollTablesField
} from "./cypher-fields.mjs";

const {
  StringField,
  NumberField,
  HTMLField,
  BooleanField,
  ArrayField,
  SchemaField
} = foundry.data.fields;

export default class CypherCypherData extends foundry.abstract.TypeDataModel {
  static migrateData(source) {
    if (source && source.level !== undefined) {
      if (source.level === "") source.level = null;
      else if (typeof source.level === "string") {
        const level = Number(source.level);
        if (Number.isFinite(level)) source.level = level;
      }
    }
    return super.migrateData ? super.migrateData(source) : source;
  }

  static defineSchema() {
    return {
      cypherCategory: new StringField({
        required: true,
        initial: "standard",
        choices: ["standard", "powerBoost"]
      }),
      cypherType: new StringField({
        required: true,
        nullable: true,
        initial: "manifest",
        choices: ["", "subtle", "manifest"]
      }),
      level: new NumberField({
        required: true, nullable: true, initial: null, integer: true, min: 0
      }),
      powerLevel: new StringField({
        required: true,
        initial: "",
        choices: ["", "low", "medium", "advanced", "high", "ultra"]
      }),
      powerLevels: new ArrayField(
        new StringField({
          required: true,
          choices: ["low", "medium", "advanced", "high", "ultra"]
        }),
        { required: true, initial: [] }
      ),
      randomRange: new SchemaField({
        min: new NumberField({
          required: true, integer: true, nullable: true, initial: null, min: 1
        }),
        max: new NumberField({
          required: true, integer: true, nullable: true, initial: null, min: 1
        })
      }),
      variants: createCypherPowerVariantsField(),
      rollTables: createCypherRollTablesField(),
      internal: new BooleanField({ required: true, initial: false }),
      identified: new BooleanField({ required: true, initial: true }),
      depleted: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
