import { CYPHER } from "../config.mjs";

const {
  HTMLField,
  ArrayField,
  SchemaField,
  DocumentUUIDField
} = foundry.data.fields;

export default class CypherFocusData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      abilities: new ArrayField(
        new DocumentUUIDField({ required: true, blank: false }),
        { required: true, initial: [] }
      ),
      flowchart: new SchemaField({
        edges: new ArrayField(new SchemaField({
          from: new DocumentUUIDField({ required: true, blank: false }),
          to: new DocumentUUIDField({ required: true, blank: false })
        }), { required: true, initial: [] })
      }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
