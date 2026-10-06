/**
 * Structured fields used by CRD Cypher source extraction.
 */
const {
  StringField,
  NumberField,
  HTMLField,
  ArrayField,
  SchemaField
} = foundry.data.fields;

export function createCypherRollTablesField() {
  return new ArrayField(new SchemaField({
    id: new StringField({ required: true, blank: false }),
    name: new StringField({ required: true, blank: false }),
    formula: new StringField({ required: true, initial: "1d100" }),
    results: new ArrayField(new SchemaField({
      min: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      max: new NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      description: new HTMLField({ required: true, blank: true })
    }), { required: true, initial: [] })
  }), { required: true, initial: [] });
}

export function createCypherPowerVariantsField() {
  return new ArrayField(new SchemaField({
    name: new StringField({ required: true, blank: false }),
    powerLevel: new StringField({
      required: true,
      choices: ["low", "medium", "advanced", "high", "ultra"]
    }),
    rollMin: new NumberField({ required: true, integer: true, min: 1 }),
    rollMax: new NumberField({ required: true, integer: true, min: 1 })
  }), { required: true, initial: [] });
}
