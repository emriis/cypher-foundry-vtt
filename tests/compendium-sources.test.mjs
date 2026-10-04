// Structural contracts for standalone abilities and reference-based Types/Foci.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function readPackSources(packName) {
  const directory = path.join(root, "packs", packName, "_source");
  return new Map(
    fs.readdirSync(directory, { recursive: true })
      .filter(file => file.endsWith(".json"))
      .map(file => [
        file,
        JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))
      ])
  );
}

function isFolder(document) {
  return document._key.startsWith("!folders!");
}

function assertDocumentIdentity(document) {
  assert.match(document._id, /^[A-Za-z0-9]{16}$/);
  assert.ok(document._key);
  assert.ok(document.name);
}

function assertUniqueDocuments(sources, packName) {
  const ids = new Set();
  const keys = new Set();

  for (const [filename, document] of sources) {
    assertDocumentIdentity(document);
    assert.equal(ids.has(document._id), false, `${packName}/${filename} duplicates _id`);
    assert.equal(keys.has(document._key), false, `${packName}/${filename} duplicates _key`);
    ids.add(document._id);
    keys.add(document._key);
  }
}

function assertAbility(document, filename) {
  assert.equal(document.type, "ability", filename);
  const system = document.system;
  assert.match(system.key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(system.variantKey, /^[A-Za-z0-9]{16}$/);
  assert.ok(document.name);
  assert.ok(system.description !== undefined);
  assert.ok(Number.isInteger(system.tier));
  assert.ok(system.tier >= 1 && system.tier <= 6);
  assert.equal(typeof system.enabler, "boolean");
  assert.equal(typeof system.repeatable, "boolean");
  assert.ok(["action", "firstAction", "lastAction", null].includes(system.action));
  assert.equal(typeof system.cost.stat, "string");
  assert.ok(Number.isInteger(system.cost.amount));
  assert.ok(system.cost.amount >= 0);
  assert.ok(Array.isArray(system.effects));
  assert.ok(Array.isArray(system.rollTables));
  assert.equal(Object.hasOwn(system, "prerequisites"), false);
}

function assertReference(value, packName) {
  assert.match(
    value,
    new RegExp(`^Compendium\\.cypher\\.${packName}\\.Item\\.[A-Za-z0-9]{16}$`)
  );
}

for (const language of ["en", "fr"]) {
  test(`${language} standalone ability source documents satisfy their schema`, () => {
    const sources = readPackSources(`abilities-${language}`);
    assert.ok(sources.size > 0);

    for (const [filename, document] of sources) {
      assert.equal(isFolder(document), false);
      assert.match(document._key, /^!items![A-Za-z0-9]{16}$/);
      assertAbility(document, filename);
    }
  });

  for (const type of ["types", "foci"]) {
    test(`${type}-${language} contains only standalone ability references`, () => {
      const sources = readPackSources(`${type}-${language}`);

      for (const [filename, document] of sources) {
        if (isFolder(document)) continue;
        assert.ok(Array.isArray(document.system.abilities));
        for (const reference of document.system.abilities) {
          assertReference(reference, `abilities-${language}`);
        }
        assert.equal(
          document.system.abilities.some(value => typeof value !== "string"),
          false,
          `${type}-${language}/${filename} embeds an ability object`
        );
      }
    });
  }
}

test("English and French ability packs keep matching mechanical documents", () => {
  const en = readPackSources("abilities-en");
  const fr = readPackSources("abilities-fr");

  assert.equal(en.size, fr.size);

  const englishDocuments = [...en.values()];

  for (const frDocument of fr.values()) {
    const enDocument = englishDocuments.find(document =>
      document.system.variantKey === frDocument.system.variantKey
    );
    assert.ok(enDocument, `Missing English ability variant for ${frDocument.system.variantKey}`);

    assert.deepEqual(
      {
        tier: frDocument.system.tier,
        enabler: frDocument.system.enabler,
        repeatable: frDocument.system.repeatable,
        action: frDocument.system.action,
        cost: frDocument.system.cost,
        effects: frDocument.system.effects,
        rollTables: frDocument.system.rollTables
      },
      {
        tier: enDocument.system.tier,
        enabler: enDocument.system.enabler,
        repeatable: enDocument.system.repeatable,
        action: enDocument.system.action,
        cost: enDocument.system.cost,
        effects: enDocument.system.effects,
        rollTables: enDocument.system.rollTables
      },
      frDocument.system.key
    );
  }
});
