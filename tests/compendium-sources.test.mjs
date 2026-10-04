// Validates editable compendium source integrity without coupling tests to editorial content.
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
      .map(file => [file, JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))])
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

function mechanicalAbilityShape(ability) {
  return {
    id: ability.id,
    tier: ability.tier,
    enabler: ability.enabler,
    repeatable: ability.repeatable,
    cost: ability.cost,
    action: ability.action,
    prerequisites: ability.prerequisites,
    effects: (ability.effects ?? []).map(effect => ({
      id: effect.id,
      effort: effect.effort,
      enabler: effect.enabler,
      cost: effect.cost,
      action: effect.action,
      rollTables: (effect.rollTables ?? []).map(table => ({
        id: table.id,
        formula: table.formula,
        results: (table.results ?? []).map(result => ({
          min: result.min,
          max: result.max
        }))
      }))
    })),
    rollTables: (ability.rollTables ?? []).map(table => ({
      id: table.id,
      formula: table.formula,
      results: (table.results ?? []).map(result => ({
        min: result.min,
        max: result.max
      }))
    }))
  };
}

function assertAbilitySchema(ability) {
  assert.match(ability.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(ability.name);
  assert.ok(ability.description !== undefined);
  assert.ok(Number.isInteger(ability.tier));
  assert.ok(ability.tier >= 1 && ability.tier <= 6);
  assert.equal(typeof ability.enabler, "boolean");
  assert.equal(typeof ability.repeatable, "boolean");
  assert.ok(["might", "speed", "intellect", "none"].includes(ability.cost.stat));
  assert.ok(Number.isInteger(ability.cost.amount) && ability.cost.amount >= 0);
  assert.ok(Array.isArray(ability.prerequisites));

  for (const effect of ability.effects ?? []) {
    assert.match(effect.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(effect.name);
    assert.ok(effect.description !== undefined);
    assert.ok(Array.isArray(effect.rollTables));
  }

  for (const table of ability.rollTables ?? []) {
    assert.match(table.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(table.name);
    assert.match(table.formula, /^\d+d\d+$/);
    assert.ok(Array.isArray(table.results) && table.results.length > 0);
    for (const result of table.results) {
      assert.ok(Number.isInteger(result.min));
      assert.ok(Number.isInteger(result.max));
      assert.ok(result.min <= result.max);
      assert.ok(result.description !== undefined);
    }
  }
}

function assertUniqueDocumentKeys(sources, packName) {
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

function assertFolderReferences(sources, packName) {
  const folders = new Set(
    [...sources.values()]
      .filter(isFolder)
      .map(folder => folder._id)
  );

  for (const [filename, document] of sources) {
    if (isFolder(document)) {
      if (document.folder != null) {
        assert.equal(
          folders.has(document.folder),
          true,
          `${packName}/${filename} references a missing parent folder`
        );
      }
      continue;
    }

    if (document.folder != null) {
      assert.equal(
        folders.has(document.folder),
        true,
        `${packName}/${filename} references a missing folder`
      );
    }
  }
}

function assertBilingualMechanicalAlignment(enSources, frSources, packName) {
  assert.deepEqual(
    [...enSources.keys()].sort(),
    [...frSources.keys()].sort(),
    `${packName}: EN/FR source files differ`
  );

  for (const [filename, en] of enSources) {
    const fr = frSources.get(filename);
    assert.equal(fr._key.startsWith("!folders!"), en._key.startsWith("!folders!"), filename);

    if (isFolder(en)) {
      assert.equal(fr.type, en.type, `${filename}/type`);
      assert.equal(fr.folder == null, en.folder == null, `${filename}/folder-depth`);
      continue;
    }

    assert.equal(fr.type, en.type, `${filename}/type`);
    assert.match(fr._id, /^[A-Za-z0-9]{16}$/, `${filename}/fr-id`);
    assert.match(en._id, /^[A-Za-z0-9]{16}$/, `${filename}/en-id`);

    if (en.type === "type") {
      for (const field of [
        "tier", "genre", "subgenre", "poolBonuses", "edgeChoice",
        "woundBonuses", "freeWeapons", "freeArmor", "freeWeaponCategories",
        "freeArmorCategories", "freeWeaponFamilies", "skillOptions", "statOptions"
      ]) {
        assert.deepEqual(fr.system[field], en.system[field], `${filename}/${field}`);
      }
      assert.deepEqual(
        fr.system.abilities.map(mechanicalAbilityShape),
        en.system.abilities.map(mechanicalAbilityShape),
        `${filename}/abilities`
      );
    }

    if (en.type === "descriptor") {
      for (const field of [
        "category", "genres", "grantsSecondDescriptor", "statOptions", "statAmount"
      ]) {
        assert.deepEqual(fr.system[field] ?? null, en.system[field] ?? null, `${filename}/${field}`);
      }
      assert.equal(
        (fr.system.skillOptions ?? []).length,
        (en.system.skillOptions ?? []).length,
        `${filename}/skillOptions/count`
      );
    }

    if (en.type === "focus") {
      assert.deepEqual(
        fr.system.abilities.map(mechanicalAbilityShape),
        en.system.abilities.map(mechanicalAbilityShape),
        `${filename}/abilities`
      );
    }
  }
}

for (const language of ["en", "fr"]) {
  test(`all ${language} compendium source documents satisfy their structural contracts`, () => {
    const packNames = ["descriptors", "types", "foci"].map(prefix => `${prefix}-${language}`);

    for (const packName of packNames) {
      const sources = readPackSources(packName);
      assert.ok(sources.size > 0, `${packName} has no source documents`);
      assertUniqueDocumentKeys(sources, packName);
      assertFolderReferences(sources, packName);

      for (const [filename, document] of sources) {
        if (isFolder(document)) {
          assert.equal(document.type, "Item", `${packName}/${filename}`);
          continue;
        }

        assert.match(document._key, /^!items![A-Za-z0-9]{16}$/, `${packName}/${filename}`);
        assert.ok(document.system.description !== undefined, `${packName}/${filename}`);

        if (document.type === "type" || document.type === "focus") {
          assert.ok(Array.isArray(document.system.abilities), `${packName}/${filename}`);
          const ids = new Set();
          for (const ability of document.system.abilities) {
            assert.equal(ids.has(ability.id), false, `${packName}/${filename}/${ability.id}`);
            ids.add(ability.id);
            assertAbilitySchema(ability);
          }
        }
      }
    }
  });
}

for (const prefix of ["descriptors", "types", "foci"]) {
  test(`${prefix} English and French sources preserve mechanical parity`, () => {
    assertBilingualMechanicalAlignment(
      readPackSources(`${prefix}-en`),
      readPackSources(`${prefix}-fr`),
      prefix
    );
  });
}
