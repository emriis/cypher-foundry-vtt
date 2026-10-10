/**
 * Reusable Foundry schemas for inline Cypher tables and power variants.
 * A field factory returns a fresh schema object for each model that uses it;
 * it describes persisted data and does not roll or select a result.
 */
const {
  StringField,
  NumberField,
  HTMLField,
  ArrayField,
  SchemaField
} = foundry.data.fields;

/**
 * Define inline tables with formulas and inclusive result ranges.
 * Descriptions are stored HTML and are enriched when the table is used.
 * @returns {ArrayField} Foundry field containing structured table definitions.
 */
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

/**
 * Define power variants selected by inclusive d100 ranges.
 * powerLevel is a classification, separate from an Item's numeric effect level.
 * @returns {ArrayField} Foundry field containing power-variant definitions.
 */
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
