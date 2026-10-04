/**
 * Shared Foundry field factories for structured ability effects and inline roll tables.
 *
 * Keeping these factories in one module ensures Type, Focus, and standalone Ability
 * data models persist the same nested ability structures.
 */

const {
  StringField,
  NumberField,
  HTMLField,
  ArrayField,
  SchemaField
} = foundry.data.fields;

/**
 * Creates the field used by an inline roll table.
 *
 * @returns {ArrayField} Roll table definitions.
 */
export function createAbilityRollTablesField() {
  return new ArrayField(new SchemaField({
    id: new StringField({ required: true, blank: false }),
    name: new StringField({ required: true, blank: false }),
    tier: new NumberField({
      required: true, integer: true, nullable: true, initial: null, min: 1, max: 6
    }),
    formula: new StringField({ required: true, initial: "1d20", blank: false }),
    results: new ArrayField(new SchemaField({
      min: new NumberField({ required: true, integer: true, initial: 1 }),
      max: new NumberField({ required: true, integer: true, initial: 1 }),
      description: new HTMLField({ required: true, blank: true })
    }), { required: true, initial: [] })
  }), { required: true, initial: [] });
}

/**
 * Creates structured effect choices for an ability.
 *
 * @returns {ArrayField} Ability effect definitions.
 */
export function createAbilityEffectsField() {
  return new ArrayField(new SchemaField({
    id: new StringField({ required: true, blank: false }),
    name: new StringField({ required: true, blank: false }),
    tier: new NumberField({
      required: true, integer: true, nullable: true, initial: null, min: 1, max: 6
    }),
    description: new HTMLField({ required: true, blank: true }),
    effort: new HTMLField({ required: true, blank: true })
  }), { required: true, initial: [] });
}
