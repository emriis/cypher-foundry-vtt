/** Interactable objects use level as protection/resistance, with a separate post-break destruction phase. */
import { objectState } from "../rules/objects.mjs";
const { NumberField, StringField, HTMLField, BooleanField } = foundry.data.fields;
export default class CypherObjectData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      originalLevel: new NumberField({ required: true, initial: 1, integer: true, min: 1 }),
      levelDamage: new NumberField({ required: true, initial: 0, integer: true, min: 0 }),
      destructionDamage: new NumberField({ required: true, initial: 0, integer: true, min: 0 }),
      physical: new BooleanField({ required: true, initial: true }),
      material: new StringField({ required: true, blank: true, initial: "" }),
      description: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }
  get level() { return objectState(this)?.level ?? 0; }
  get status() { return objectState(this)?.status ?? "invalid"; }
  get targetNumber() { return this.level * 3; }
}
