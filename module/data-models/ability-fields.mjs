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
  SchemaField,
  BooleanField
} = foundry.data.fields;

/**
 * Creates a structured recovery-based end condition.
 *
 * This represents only the recovery boundary explicitly stated by the source.
 * Runtime state (active/inactive, applied effects, cooldowns) belongs to
 * actor-owned data and is deliberately not stored here.
 *
 * @returns {SchemaField} Recovery end-condition definition.
 */
function createAbilityEffectModifierField() {
  return new SchemaField({
    kind: new StringField({
      required: true,
      choices: ["poolMax", "edge", "woundCapacity"]
    }),
    stat: new StringField({ required: true, blank: true, initial: "" }),
    severity: new StringField({ required: true, blank: true, initial: "" }),
    amount: new NumberField({
      required: true,
      integer: true,
      initial: 0
    })
  });
}

/**
 * Creates structured self-modifiers for an Ability effect.
 *
 * Only mechanics with an explicit, source-grounded representation are stored
 * here. Effect prose is never parsed into modifiers.
 *
 * @returns {ArrayField} Ability effect modifiers.
 */
export function createAbilityEffectModifiersField() {
  return new ArrayField(
    createAbilityEffectModifierField(),
    { required: true, initial: [] }
  );
}

function createRecoveryEndConditionField() {
  return new SchemaField({
    kind: new StringField({
      required: true,
      initial: "recovery",
      choices: ["recovery"]
    }),
    interval: new StringField({
      required: true,
      initial: "any",
      choices: ["any", "tenMinutes", "hour", "tenHours"]
    }),
    minimum: new BooleanField({
      required: true,
      initial: false
    })
  });
}

/**
 * Creates structured end conditions for an ability effect.
 *
 * Recovery conditions are structured when the CRD gives an explicit recovery
 * boundary. Other source conditions remain in the effect description until
 * they have a source-justified structured representation.
 *
 * @returns {ArrayField} Ability effect end-condition definitions.
 */
export function createAbilityEndConditionsField() {
  return new ArrayField(
    createRecoveryEndConditionField(),
    { required: true, initial: [] }
  );
}

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
    effort: new HTMLField({ required: true, blank: true }),
    modifiers: createAbilityEffectModifiersField(),
    endConditions: createAbilityEndConditionsField()
  }), { required: true, initial: [] });
}
