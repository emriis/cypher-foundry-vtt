const { HTMLField } = foundry.data.fields;

export default class CypherOddityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
