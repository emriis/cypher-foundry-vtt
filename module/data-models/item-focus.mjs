/**
 * Data model for a Cypher Focus. Its flowchart belongs to the Focus because
 * prerequisites are contextual; referenced abilities remain reusable documents.
 */
const { DocumentUUIDField, HTMLField, ArrayField, SchemaField, StringField } = foundry.data.fields;

export default class CypherFocusData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      abilities: new ArrayField(
        new DocumentUUIDField({ type: "Item", nullable: false }),
        { required: true, initial: [] }
      ),
      flowchart: new SchemaField({
        edges: new ArrayField(new SchemaField({
          from: new StringField({ required: true, blank: false }),
          to: new StringField({ required: true, blank: false })
        }), { required: true, initial: [] })
      }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
