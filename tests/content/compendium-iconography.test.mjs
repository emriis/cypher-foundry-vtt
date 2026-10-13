/**
 * Iconography is part of compendium source normalization: all item families
 * must have images, every bilingual pair must resolve to the same artwork,
 * and system-owned image URLs must resolve to packageable local assets.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const families = ["descriptors", "foci", "equipment"];

function readRecords(family, language) {
  const source = path.join(root, "packs", family + "-" + language, "_source");
  const records = new Map();
  for (const file of fs.readdirSync(source, { recursive: true })) {
    if (!file.endsWith(".json")) continue;
    const document = JSON.parse(
      fs.readFileSync(path.join(source, file), "utf8")
    );
    if (document._key?.startsWith("!folders!")) continue;
    records.set(file.replace(/\\/g, "/"), document);
  }
  return records;
}

for (const family of families) {
  test(family + " items expose an image in both locales with a packaged path", () => {
    const english = readRecords(family, "en");
    const french = readRecords(family, "fr");
    assert.ok(english.size > 0, family);
    assert.deepEqual([...french.keys()].sort(), [...english.keys()].sort());

    const generated = new Set();
    for (const [file, en] of english) {
      const fr = french.get(file);
      assert.equal(typeof en.img, "string", file + "/en");
      assert.ok(en.img.length > 0, file + "/image");
      assert.equal(fr.img, en.img, file + "/bilingual");

      if (en.img.startsWith("systems/cypher/")) {
        const relativePath = en.img.slice("systems/cypher/".length);
        assert.ok(relativePath.startsWith("assets/compendium/"), file);
        const asset = path.resolve(root, relativePath);
        assert.ok(
          asset.startsWith(path.join(root, "assets", "compendium") + path.sep),
          file + "/asset traversal"
        );
        assert.ok(fs.existsSync(asset), file + "/missing image " + en.img);
        const svg = fs.readFileSync(asset, "utf8");
        assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
        assert.match(svg, /<title>.+<\/title>/);
        assert.ok(!generated.has(en.img), file + "/duplicate icon asset");
        generated.add(en.img);
      } else {
        // Built-in Foundry images already curated for this record.
        assert.match(en.img, /^icons\//, file + "/external image");
      }
    }
    if (family !== "foci") assert.ok(generated.size > 0, family);
  });
}

test("generic descriptor artwork is replaced with individually authored icons", () => {
  const descriptors = readRecords("descriptors", "en");
  const images = [...descriptors.values()].map(document => document.img);
  assert.equal(new Set(images).size, images.length);
  for (const icon of images) {
    assert.notEqual(icon, "icons/svg/aura.svg");
    assert.ok(icon.startsWith("systems/cypher/assets/compendium/descriptors/"));
  }
});
