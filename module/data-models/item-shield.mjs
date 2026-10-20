import { CYPHER } from "../config.mjs";
import { resolveShieldWoundTrack } from "../rules/ability-modifiers.mjs";
import { isShieldBroken } from "../rules/wounds.mjs";
import { shieldSurvivesMajor } from "../rules/shield-abilities.mjs";

/**
 * Data model for a shield and its independent wound track.
 *
 * CypherActor updates this track when a successful Block transfers a wound
 * from the character to an equipped, unbroken shield.
 */
const { SchemaField, NumberField, HTMLField, BooleanField, StringField } =
  foundry.data.fields;

export default class CypherShieldData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const woundSchema = (max) => new SchemaField({
      max: new NumberField({
        required: true, integer: true, initial: max, min: 0
      }),
      current: new NumberField({
        required: true, integer: true, initial: 0, min: 0
      })
    });

    return {
      // Any character can use a shield freely, regardless of their Type.
      equipped: new BooleanField({ required: true, initial: false }),
      // Additive defaults preserve ordinary shields. A designation references
      // one owned Ability; a display name never grants an exception.
      abilityItemId: new StringField({ required: true, initial: "", blank: true }),
      inHand: new BooleanField({ required: true, initial: true }),
      flightId: new StringField({ required: true, initial: "", blank: true }),
      repairReadyAt: new NumberField({ required: true, nullable: true, initial: null, min: 0 }),
      replacementReadyAt: new NumberField({ required: true, nullable: true, initial: null, min: 0 }),
      priceCategory: new StringField({
        required: true, initial: "moderate", choices: CYPHER.priceCategories
      }),

      // A shield has its own wound track: 3 minor, 2 moderate, 1 major.
      wounds: new SchemaField({
        minor: woundSchema(CYPHER.defaultShieldWoundMax.minor),
        moderate: woundSchema(CYPHER.defaultShieldWoundMax.moderate),
        major: woundSchema(CYPHER.defaultShieldWoundMax.major)
      }),

      description: new HTMLField({ required: true, blank: true })
    };
  }

  prepareDerivedData() {
    const actor = this.parent?.actor;
    const items = actor?.items;
    // The owner supplies Shield Master; the Item keeps its independent saved
    // track. Unowned shields receive no benefit and no saved values are changed.
    this.effectiveWounds = resolveShieldWoundTrack(this.wounds, actor?.system.activeAbilityEffects,
      items?.contents ?? (Array.isArray(items) ? items : Array.from(items?.values?.() ?? [])), actor?.system);
    // Unyielding Shield replaces destruction, but does not erase the recorded
    // major wound. Losing its owning Ability removes that exception.
    this.broken = isShieldBroken(this.wounds, shieldSurvivesMajor(this.parent,
      items?.contents ?? (Array.isArray(items) ? items : Array.from(items?.values?.() ?? []))));
  }
}
