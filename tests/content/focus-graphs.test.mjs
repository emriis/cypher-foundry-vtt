// Validates Focus flowcharts and their references to standalone abilities.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

class FieldDefinition {
  constructor(options = {}) { this.options = options; }
}
class ArrayField extends FieldDefinition {
  constructor(element, options = {}) { super(options); this.element = element; }
}
class SchemaField extends FieldDefinition {
  constructor(fields, options = {}) { super(options); this.fields = fields; }
}

globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: {
    StringField: FieldDefinition,
    NumberField: FieldDefinition,
    HTMLField: FieldDefinition,
    BooleanField: FieldDefinition,
    DocumentUUIDField: FieldDefinition,
    ArrayField,
    SchemaField
  }}
};

const { default: CypherFocusData } =
  await import("../../module/data-models/item-focus.mjs");

function readPack(pack) {
  const directory = path.join(root, "packs", pack, "_source");
  return fs.readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")));
}

function readAbilities(language) {
  return new Map(
    readPack(`abilities-${language}`)
      .map(document => [document._id, document])
  );
}

for (const language of ["en", "fr"]) {
  test(`${language} Focus flowchart edges reference abilities in the Focus`, () => {
    const abilities = readAbilities(language);

    for (const focus of readPack(`foci-${language}`)) {
      const refs = focus.system.abilities ?? [];
      const ids = new Set(refs.map(uuid => uuid.split(".").at(-1)));
      assert.equal(ids.size, refs.length);

      const byId = new Map(
        [...ids].map(id => [id, abilities.get(id)])
      );
      for (const [id, ability] of byId) {
        assert.ok(ability, `${focus.name}/missing ability ${id}`);
        assert.equal(ability.type, "ability");
      }

      for (const edge of focus.system.flowchart?.edges ?? []) {
        assert.ok(ids.has(edge.from), `${focus.name}/${edge.from}`);
        assert.ok(ids.has(edge.to), `${focus.name}/${edge.to}`);
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        assert.ok(from.system.tier <= to.system.tier);
      }
    }
  });
}

test("Focus data model stores UUID references and an external flowchart", () => {
  const schema = CypherFocusData.defineSchema();
  assert.equal(schema.abilities.element.options.type, "Item");
  assert.ok(schema.flowchart.fields.edges);
  assert.ok(!schema.abilities.element.fields);
});

test("same-name abilities can remain distinct documents when their mechanics differ", () => {
  const abilities = readPack("abilities-en");
  const byName = new Map();

  for (const ability of abilities) {
    const list = byName.get(ability.name) ?? [];
    list.push(ability);
    byName.set(ability.name, list);
  }

  for (const [name, documents] of byName) {
    const signatures = new Set(documents.map(document =>
      JSON.stringify({
        tier: document.system.tier,
        enabler: document.system.enabler,
        repeatable: document.system.repeatable,
        cost: document.system.cost,
        action: document.system.action,
        effects: document.system.effects,
        rollTables: document.system.rollTables
      })
    ));
    if (signatures.size > 1) {
      assert.ok(
        documents.every(document => document._id),
        `${name} has distinct technical identities`
      );
    }
  }
});
