import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function flattenKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return entry && typeof entry === "object" && !Array.isArray(entry)
      ? flattenKeys(entry, fullKey)
      : [fullKey];
  });
}

test("Foundry manifest points to existing system entry points, locales, and pack sources", () => {
  const manifest = readJson("system.json");

  assert.equal(manifest.id, "cypher");
  for (const file of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(language => language.path)]) {
    assert.ok(fs.existsSync(path.join(root, file)), `Manifest resource does not exist: ${file}`);
  }

  const actorTypes = Object.keys(manifest.documentTypes.Actor);
  assert.deepEqual(actorTypes, ["pc", "npc", "community"]);
  for (const type of ["skill", "ability", "cypher", "artifact", "oddity", "equipment", "attack", "armor", "shield", "descriptor", "type"]) {
    assert.ok(manifest.documentTypes.Item[type], `Item type missing from manifest: ${type}`);
  }

  for (const pack of manifest.packs) {
    assert.ok(fs.existsSync(path.join(root, pack.path, "_source")), `Pack source does not exist: ${pack.path}`);
    assert.equal(pack.type, "Item");
    assert.equal(pack.system, manifest.id);
  }
});

test("French and English locales expose the same keys and interpolation variables", () => {
  const en = readJson("lang/en.json");
  const fr = readJson("lang/fr.json");
  const enKeys = flattenKeys(en).sort();
  const frKeys = flattenKeys(fr).sort();

  assert.deepEqual(frKeys, enKeys);

  for (const key of enKeys) {
    const valueAt = (object, dottedKey) => dottedKey.split(".").reduce((value, part) => value[part], object);
    const placeholders = value => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(placeholders(valueAt(fr, key)), placeholders(valueAt(en, key)), `Interpolation mismatch at ${key}`);
  }
});

test("each declared pack has a corresponding language-specific source set", () => {
  const manifest = readJson("system.json");

  for (const pack of manifest.packs) {
    const sourceDirectory = path.join(root, pack.path, "_source");
    const sourceFiles = fs.readdirSync(sourceDirectory).filter(file => file.endsWith(".json"));
    assert.ok(sourceFiles.length > 0, `Pack has no JSON source files: ${pack.name}`);

    for (const file of sourceFiles) {
      const item = JSON.parse(fs.readFileSync(path.join(sourceDirectory, file), "utf8"));
      if (item._key.startsWith("!folders!")) {
        assert.match(item._key, /^!folders![A-Za-z0-9]{16}$/);
        assert.equal(item.type, "Item");
        assert.ok(item.name);
        continue;
      }
      assert.ok(manifest.documentTypes.Item[item.type], `${pack.name}/${file} has an undeclared Item type`);
      assert.match(item._key, /^!items![A-Za-z0-9]{16}$/, `${pack.name}/${file} has an invalid compendium key`);
    }
  }
});
