/** Check identities before indexing records, so duplicate keys cannot silently overwrite an entry. */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../../packs");
for (const pack of (await readdir(root)).filter(name => /-(en|fr)$/.test(name))) {
  test(`${pack} has unique source IDs and matching database keys`, async () => {
    const ids = new Set(), keys = new Set();
    const source = path.join(root, pack, "_source");
    const files = (await readdir(source, { recursive: true })).filter(file => file.endsWith(".json"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const record = JSON.parse(await readFile(path.join(source, file), "utf8"));
      assert.equal(typeof record._id, "string", file);
      assert.ok(record._id.length > 0, file);
      assert.equal(ids.has(record._id), false, `Duplicate ID: ${pack}/${file}`);
      assert.equal(keys.has(record._key), false, `Duplicate key: ${pack}/${file}`);
      assert.ok(record._key.endsWith(`!${record._id}`), `Mismatched database key: ${pack}/${file}`);
      ids.add(record._id); keys.add(record._key);
    }
  });
}
