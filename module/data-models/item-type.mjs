/**
 * Data model for a Cypher Type. Type abilities are reusable Item UUID references;
 * the ability mechanics themselves live in the standalone ability compendium.
 */
import { CYPHER } from "../config.mjs";

const { StringField, NumberField, HTMLField, ArrayField, BooleanField, SchemaField, DocumentUUIDField } = foundry.data.fields;

export default class CypherTypeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier: new NumberField({
        required: true, integer: true, initial: 1, min: 1, max: 6
      }),
      genre: new StringField({ required: true, initial: "Fantasy" }),
      subgenre: new StringField({ required: true, initial: "" }),
      poolBonuses: new SchemaField({
        might: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        speed: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        intellect: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }),
      edgeChoice: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      woundBonuses: new SchemaField({
        minor: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        moderate: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        major: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }),
      freeWeapons: new BooleanField({ required: true, initial: false }),
      freeArmor: new BooleanField({ required: true, initial: false }),
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
      skillOptions: new ArrayField(
        new StringField({ required: true, blank: true }),
        { required: true, initial: [] }
      ),
      abilities: new ArrayField(
        new DocumentUUIDField({ type: "Item", nullable: false }),
        { required: true, initial: [] }
      ),
      abilityTiers: new ArrayField(new SchemaField({
        ability: new DocumentUUIDField({ type: "Item", nullable: false }),
        tier: new NumberField({
          required: true, integer: true, min: 1, max: 6
        })
      }), { required: true, initial: [] }),
      statOptions: new ArrayField(
        new StringField({
          required: true,
          choices: ["might", "speed", "intellect"]
        }),
        { required: true, initial: [] }
      ),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
