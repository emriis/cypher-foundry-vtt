// Validates the normalized standalone compendium source architecture.
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

function assertIdentity(document, packName, filename) {
  assert.match(document._id, /^[A-Za-z0-9]{16}$/);
  assert.match(document._key, /^!items![A-Za-z0-9]{16}$/);
  assert.ok(document.name, `${packName}/${filename}/name`);
}

function abilityIdFromUuid(uuid) {
  return uuid.split(".").at(-1);
}

function mechanicalAbilityShape(system) {
  return {
    key: system.key,
    tier: system.tier,
    enabler: system.enabler,
    repeatable: system.repeatable,
    cost: system.cost,
    action: system.action,
    freeWeaponCategories: system.freeWeaponCategories,
    freeArmorCategories: system.freeArmorCategories,
    freeWeaponFamilies: system.freeWeaponFamilies,
    freeWeaponSkillCategories: system.freeWeaponSkillCategories,
    chooseWeaponAttackCategory: system.chooseWeaponAttackCategory,
    grantedArmorItemCategory: system.grantedArmorItemCategory,
    effects: (system.effects ?? []).map(effect => ({
      id: effect.id,
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
    rollTables: (system.rollTables ?? []).map(table => ({
      id: table.id,
      formula: table.formula,
      results: (table.results ?? []).map(result => ({
        min: result.min,
        max: result.max
      }))
    }))
  };
}

function assertAbilityDocument(document, packName, filename) {
  assertIdentity(document, packName, filename);
  assert.equal(document.type, "ability");
  assert.equal(typeof document.system.key, "string");
  assert.ok(document.system.key.length > 0);
  assert.ok(Number.isInteger(document.system.tier));
  assert.ok(document.system.tier >= 1 && document.system.tier <= 6);
  assert.equal(typeof document.system.enabler, "boolean");
  assert.equal(typeof document.system.repeatable, "boolean");
  assert.ok(["action", "firstAction", "lastAction", null].includes(document.system.action));
  if (document.system.enabler) assert.equal(document.system.action, null);
  assert.equal("prerequisites" in document.system, false);
  assert.ok(document.system.description !== undefined);
}

function assertAbilityReferences(document, packName, language) {
  const refs = document.system.abilities ?? [];
  assert.ok(Array.isArray(refs), `${packName}/abilities`);
  for (const uuid of refs) {
    assert.match(
      uuid,
      new RegExp(`^Compendium\\.cypher\\.abilities-${language}\\.Item\\.[A-Za-z0-9]{16}$`)
    );
  }
  assert.equal(new Set(refs).size, refs.length);
  return new Set(refs.map(abilityIdFromUuid));
}

for (const language of ["en", "fr"]) {
  test(`all ${language} standalone ability sources satisfy their contracts`, () => {
    const sources = readPackSources(`abilities-${language}`);
    assert.ok(sources.size > 0);

    for (const [filename, document] of sources) {
      assert.equal(isFolder(document), false);
      assertAbilityDocument(document, `abilities-${language}`, filename);
    }
  });

  test(`${language} Types and Foci reference standalone abilities only`, () => {
    for (const prefix of ["types", "foci"]) {
      const sources = readPackSources(`${prefix}-${language}`);
      for (const [filename, document] of sources) {
        if (isFolder(document)) continue;
        assertIdentity(document, `${prefix}-${language}`, filename);
        assert.ok(Array.isArray(document.system.abilities));

        const ids = assertAbilityReferences(
          document,
          `${prefix}-${language}/${filename}`,
          language
        );

        if (prefix === "foci") {
          assert.ok(document.system.flowchart);
          assert.ok(Array.isArray(document.system.flowchart.edges));
          for (const edge of document.system.flowchart.edges) {
            assert.ok(ids.has(edge.from), `${filename}/edge.from`);
            assert.ok(ids.has(edge.to), `${filename}/edge.to`);
          }
        }
      }
    }
  });
}

test("English and French ability packs preserve mechanical parity", () => {
  const en = readPackSources("abilities-en");
  const fr = readPackSources("abilities-fr");
  assert.deepEqual([...en.keys()].sort(), [...fr.keys()].sort());

  for (const [filename, english] of en) {
    const french = fr.get(filename);
    assert.equal(french.type, "ability");
    assert.deepEqual(
      mechanicalAbilityShape(french.system),
      mechanicalAbilityShape(english.system),
      `${filename}/mechanics`
    );
  }
});

for (const prefix of ["types", "foci"]) {
  test(`${prefix} English and French sources preserve structural mechanics`, () => {
    const en = readPackSources(`${prefix}-en`);
    const fr = readPackSources(`${prefix}-fr`);
    assert.deepEqual([...en.keys()].sort(), [...fr.keys()].sort());

    for (const [filename, english] of en) {
      const french = fr.get(filename);
      assert.equal(french.type, english.type, `${filename}/type`);
      assert.deepEqual(
        french.system.abilities,
        english.system.abilities.map(uuid =>
          uuid.replace("abilities-en", "abilities-fr")
        ),
        `${filename}/abilities`
      );
      if (prefix === "foci") {
        assert.deepEqual(
          french.system.flowchart,
          english.system.flowchart,
          `${filename}/flowchart`
        );
      }
    }
  });
}
