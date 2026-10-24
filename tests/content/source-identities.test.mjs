/** Validate every canonical and derived French source ID before indexing. */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readdir } from "node:fs/promises";
import { readPackSourceMap } from "../helpers/canonical-sources.mjs";

const root = path.resolve(import.meta.dirname, "../..");
for (const pack of (await readdir(path.join(root, "packs"))).filter(name => /-(en|fr)$/.test(name))) {
  test(`${pack} has unique canonical IDs and matching compiler keys`, () => {
    const ids = new Set(), keys = new Set();
    const records = readPackSourceMap(root, pack);
    assert.ok(records.size > 0);
    for (const [file, record] of records) {
      assert.equal(typeof record._id, "string", file);
      assert.ok(record._id.length > 0, file);
      assert.equal(ids.has(record._id), false, `Duplicate ID: ${pack}/${file}`);
      assert.equal(keys.has(record._key), false, `Duplicate key: ${pack}/${file}`);
      assert.ok(record._key.endsWith(`!${record._id}`), `Mismatched key: ${pack}/${file}`);
      ids.add(record._id);
      keys.add(record._key);
    }
  });
}
