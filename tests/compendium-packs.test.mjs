import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const packNames = [
  "descriptors-en",
  "descriptors-fr",
  "types-en",
  "types-fr",
  "foci-en",
  "foci-fr"
];

for (const packName of packNames) {
  test(`compiled compendium pack exists: ${packName}`, () => {
    const directory = path.join(root, "packs", packName);

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
