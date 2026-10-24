import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("French Folder translations match canonical English Folder sources", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const names = JSON.parse(await fs.readFile(path.join(root, "translations/fr/_folders.json"), "utf8"));
  assert.equal(Object.keys(names).length, 9);
  for (const [key, { source, text }] of Object.entries(names)) {
    assert.ok(source && text, `Missing bilingual Folder name: ${key}`);
    const family = key.split("/")[0], relative = key.slice(key.indexOf("/") + 1);
    const document = JSON.parse(await fs.readFile(
      path.join(root, "packs", family + "-en", "_source", relative), "utf8"));
    assert.match(document._key, /^!folders!/);
    assert.equal(source, document.name, `Stale English Folder label: ${key}`);
  }
});
