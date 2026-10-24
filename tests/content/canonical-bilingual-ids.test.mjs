/**
 * Production catalogue contract after isolated source normalization.
 * Content CI normalizes source files first; authored legacy filenames remain
 * independent from the canonical Foundry IDs and CRD source text.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readPackSourceMap, readPackSources } from "../helpers/canonical-sources.mjs";
import { readCompendiumCatalogue } from "../../scripts/review-translations.mjs";
import { proposedFoundryId, proposedLogicalId, proposedPageId, proposedFolderId } from "../../scripts/source-migration/id-contract.mjs";

test("every normalized CRD document has the same deterministic ID in both languages", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const records = await readCompendiumCatalogue(root);
  const groups = new Map(), ids = new Set();
  for (const row of records) {
    const { pack, logicalId, document } = row;
    const family = pack.replace(/-(en|fr)$/, "");
    const key = family + ":" + logicalId;
    const language = pack.slice(-2);
    const group = groups.get(key) ?? {};
    assert.equal(group[language], undefined, "Duplicate locale: " + key + "/" + language);
    group[language] = document;
    groups.set(key, group);
    assert.equal(proposedLogicalId(logicalId), logicalId, "Noncanonical ID " + key);
    const id = proposedFoundryId(logicalId);
    assert.equal(document._id, id, key + " must use canonical Foundry ID");
    assert.equal(document._key, (document.document === "JournalEntry" ? "!journal!" : "!items!") + id, key);
    const scoped = pack + ":" + id;
    assert.ok(!ids.has(scoped), "Duplicate Foundry ID: " + scoped);
    ids.add(scoped);
    if (language === "fr") {
      assert.equal(document.flags.cypherFoundry.crd.sourceLogicalId, logicalId);
    }
  }
  assert.equal(groups.size, 1373, "Review the inventory when CRD content is intentionally added.");
  for (const [key, group] of groups) {
    assert.ok(group.en && group.fr, "Missing EN/FR counterpart: " + key);
    assert.equal(group.en._id, group.fr._id);
    if (group.en.document === "JournalEntry") {
      assert.equal(group.en.pages.length, group.fr.pages.length, key);
      for (let i = 0; i < group.en.pages.length; i++) {
        const en = group.en.pages[i], fr = group.fr.pages[i];
        const anchor = en.flags?.cypherFoundry?.identity?.sourcePageId;
        assert.ok(anchor, "Missing original CRD page anchor: " + key);
        assert.equal(en._id, proposedPageId(group.en.flags.cypherFoundry.crd.logicalId, anchor));
        assert.equal(fr._id, en._id);
        assert.equal(fr._key, en._key);
      }
    }
  }
});

test("every normalized Folder ID and Item.folder reference uses the same bilingual policy", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const folders = new Map(), records = [];
  for (const pack of (await fs.readdir(path.join(root, "packs"))).filter(name => /-(?:en|fr)$/.test(name))) {
    for (const [relative, d] of readPackSourceMap(root, pack)) {
      if (d._key?.startsWith("!folders!")) {
        const target = proposedFolderId(pack.replace(/-(en|fr)$/, ""), relative);
        assert.equal(d._id, target);
        assert.equal(d._key, "!folders!" + target);
        folders.set(pack + ":" + d._id, d);
      }
      records.push({ pack, relative, d });
    }
  }
  for (const { pack, relative, d } of records) {
    if (d.folder) assert.ok(folders.has(pack + ":" + d.folder), "Unresolved folder: " + pack + "/" + relative);
  }
});
