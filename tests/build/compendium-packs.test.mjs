// Verifies that every authored source pack has a compiled LevelDB directory for Foundry to load.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const packsRoot = path.join(root, "packs");

const packNames = fs
  .readdirSync(packsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .filter(name => name.endsWith("-en") || name.endsWith("-fr"))
  .filter(name => fs.existsSync(path.join(packsRoot, name, "_source")))
  .sort();

for (const packName of packNames) {
  test(`compiled compendium pack exists: ${packName}`, () => {
    const directory = path.join(packsRoot, packName);

    assert.ok(fs.existsSync(directory), `Missing pack directory: ${packName}`);
    assert.ok(
      fs.existsSync(path.join(directory, "_source")),
      `Missing source directory: ${packName}`
    );
    assert.ok(
      fs.existsSync(path.join(directory, "CURRENT")),
      `Missing LevelDB CURRENT file: ${packName}`
    );
    assert.ok(
      fs.readdirSync(directory).some(file => file.startsWith("MANIFEST-")),
      `Missing LevelDB manifest: ${packName}`
    );
  });
}

test("at least one authored compendium pack exists", () => {
  assert.ok(packNames.length > 0);
});
