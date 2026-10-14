// Names are independently transcribed from the supplied CRD headings. Display
// punctuation must remain source-faithful without renaming existing documents.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

// Paragraph indexes refer to the 2026-07-29 CRD, not another published book.
const sourceNames = [
  ["abilities", "0fa12863b5115638.json", "Nature’s Grip", "0fa12863b5115638", 4926],
  ["abilities", "2b1dddec956c9df0.json", "Drawing on Life’s Experiences", "2b1dddec956c9df0", 4017],
  ["abilities", "2b460282fa97faed.json", "Hunter’s Determination", "2b460282fa97faed", 4406],
  ["abilities", "3ba07674cbea4e97.json", "Hunter’s Drive", "3ba07674cbea4e97", 4429],
  ["abilities", "44c750f170527f4c.json", "Wizard’s Cunning", "44c750f170527f4c", 1723],
  ["abilities", "7ea769276656e57c.json", "Explorer’s Awareness", "7ea769276656e57c", 4129],
  ["abilities", "852f41eb076ca473.json", "Out of Harm’s Way", "852f41eb076ca473", 4894],
  ["abilities", "8ba041f47f9dfd31.json", "Nature’s Voice", "8ba041f47f9dfd31", 4931],
  ["abilities", "fc874f02bd02f265.json", "Winter’s Grip", "fc874f02bd02f265", 5180],
  ["descriptors", "species/d-nec.json", "D’nec", "N4eC7sL2wF9hJ5uQ", 2830],
  ["foci", "doesnt-do-much.json", "Doesn’t Do Much", "doesntdomuBBA343", 3993]
];

test("Given independently reviewed CRD names, then English display punctuation is exact and existing document IDs remain stable", () => {
  for (const [family, file, name, id, paragraph] of sourceNames) {
    const document = JSON.parse(fs.readFileSync(path.join(root, "packs", `${family}-en`, "_source", file), "utf8"));
    assert.equal(document.name, name, `CRD paragraph ${paragraph}: ${file}`);
    assert.equal(document._id, id, "A display punctuation correction must preserve imported references");
    assert.equal(document._key, `!items!${id}`);
  }
});
