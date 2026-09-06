const { NumberField, HTMLField } = foundry.data.fields;

export default class CypherCommunityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier: new NumberField({ required: true, integer: true, initial: 1, min: 1, max: 6 }),
      description: new HTMLField({ required: true, blank: true }),
      resources: new HTMLField({ required: true, blank: true }),
      notes: new HTMLField({ required: true, blank: true })
    };
  }
}
