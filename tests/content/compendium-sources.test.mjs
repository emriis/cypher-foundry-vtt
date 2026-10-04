import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

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

function abilityIndex(language) {
  return new Map(
    [...readPackSources(`abilities-${language}`).values()]
      .filter(document => !isFolder(document))
      .map(document => [document._id, document.system.key])
  );
}

for (const language of ["en", "fr"]) {
  test(`${language} standalone abilities have valid schemas`, () => {
    const sources = readPackSources(`abilities-${language}`);
    assert.ok(sources.size > 0);

    for (const [filename, document] of sources) {
      if (isFolder(document)) continue;
      assert.equal(document.type, "ability");
      assert.match(document._id, /^[A-Za-z0-9]{16}$/);
      assert.match(document._key, /^!items![A-Za-z0-9]{16}$/);
      assert.ok(document.system.key);
      assert.ok(Number.isInteger(document.system.tier));
      assert.ok(document.system.tier >= 1 && document.system.tier <= 6);
      assert.ok(
        ["action", "firstAction", "lastAction", null].includes(
          document.system.action
        )
      );
      if (document.system.enabler) {
        assert.equal(document.system.action, null);
      }
      assert.equal("prerequisites" in document.system, false);
      assert.ok(document.system.description !== undefined, filename);
    }
  });

  test(`${language} Types and Foci reference ability UUIDs`, () => {
    for (const prefix of ["types", "foci"]) {
      const sources = readPackSources(`${prefix}-${language}`);
      for (const [filename, document] of sources) {
        if (isFolder(document)) continue;
        assert.equal(document.type, prefix === "types" ? "type" : "focus");
        assert.ok(Array.isArray(document.system.abilities), filename);

        for (const uuid of document.system.abilities) {
          assert.match(
            uuid,
            new RegExp(
              `^Compendium\\.cypher\\.abilities-${language}\\.Item\\.[A-Za-z0-9]{16}$`
            )
          );
        }

        if (prefix === "foci") {
          const ids = new Set(
            document.system.abilities.map(uuid => uuid.split(".").at(-1))
          );
          for (const edge of document.system.flowchart?.edges ?? []) {
            assert.ok(ids.has(edge.from), `${filename}/from`);
            assert.ok(ids.has(edge.to), `${filename}/to`);
          }
        }
      }
    }
  });
}

test("English and French ability packs expose the same logical keys", () => {
  const en = new Set(
    [...readPackSources("abilities-en").values()]
      .filter(document => !isFolder(document))
      .map(document => document.system.key)
  );
  const fr = new Set(
    [...readPackSources("abilities-fr").values()]
      .filter(document => !isFolder(document))
      .map(document => document.system.key)
  );
  assert.deepEqual([...fr].sort(), [...en].sort());
});

for (const prefix of ["types", "foci"]) {
  test(`${prefix} English and French relationships preserve logical abilities`, () => {
    const en = readPackSources(`${prefix}-en`);
    const fr = readPackSources(`${prefix}-fr`);
    const enAbilities = abilityIndex("en");
    const frAbilities = abilityIndex("fr");

    assert.deepEqual([...en.keys()].sort(), [...fr.keys()].sort());

    for (const [filename, english] of en) {
      if (isFolder(english)) continue;
      const french = fr.get(filename);
      const englishKeys = english.system.abilities.map(uuid =>
        enAbilities.get(uuid.split(".").at(-1))
      );
      const frenchKeys = french.system.abilities.map(uuid =>
        frAbilities.get(uuid.split(".").at(-1))
      );
      assert.deepEqual(frenchKeys, englishKeys, `${filename}/abilities`);

      if (prefix === "foci") {
        const normalizeEdges = (document, index) =>
          (document.system.flowchart?.edges ?? []).map(edge => [
            index.get(edge.from),
            index.get(edge.to)
          ]);
        assert.deepEqual(
          normalizeEdges(english, enAbilities),
          normalizeEdges(french, frAbilities),
          `${filename}/flowchart`
        );
      }
    }
  });
}
