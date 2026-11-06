/** Every genre paragraph is readable either in its Journal or a proven Item field. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readChapterReference } from "../../scripts/author-reference-chapters.mjs";
import { readReferenceCatalogue } from "../../scripts/crd-reference/catalogue.mjs";
import { authorGenreChapters } from "../../scripts/author-genre-chapters.mjs";
import { buildGenreChapters } from "../../scripts/crd-reference/genre-chapters.mjs";
import { translationFields } from "../../scripts/localization/compendium-translations.mjs";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const [paragraphs, records] = await Promise.all([readChapterReference(root), readReferenceCatalogue(root)]);
const built = buildGenreChapters(paragraphs, records);
const visible = text => plainText(text.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1"));

test("Genre chapters partition all 2947 nonblank paragraphs without losing source prose", () => {
  assert.equal(built.documents.length, 5);
  assert.equal(built.coverage.nonblankParagraphs, 2947);
  for (const document of built.documents) assert.equal(new Set(document.pages.map(page => page._id)).size, document.pages.length);
  const seen = new Set();
  for (const target of built.coverage.destinations) {
    const source = paragraphs.filter(p => p.index >= target.start && p.index <= target.end && p.text.trim());
    assert.equal(target.sourceSha256, createHash("sha256").update(source.map(p => p.text).join("\n")).digest("hex"));
    const document = built.documents.find(doc => doc.flags.cypherFoundry.crd.logicalId === target.logicalId);
    const page = document?.pages.find(entry => entry._id === target.pageId);
    const fields = target.kind === "journal" ? `${page.name} ${page.text.content}`
      : translationFields(records.find(row => row.logicalId === target.logicalId).document).get(target.field);
    for (const paragraph of source) {
      assert.ok(!seen.has(paragraph.index), `duplicate paragraph ${paragraph.index}`);
      seen.add(paragraph.index);
      assert.ok(visible(fields).includes(plainText(target.strippedPrefix ? paragraph.text.slice(target.strippedPrefix.length) : paragraph.text)),
        `missing paragraph ${paragraph.index} in ${target.logicalId}`);
    }
  }
  assert.deepEqual([...seen], paragraphs.filter(p => p.index >= 457 && p.index <= 3437 && p.text.trim()).map(p => p.index));
});

test("Genre authoring is reproducible and every native Item link resolves to a canonical record", async () => {
  assert.deepEqual((await authorGenreChapters(root)).coverage, built.coverage);
  const targets = new Set(records.map(row => `Compendium.cypher.${row.pack}.Item.${row.document._id}`));
  const links = built.documents.flatMap(doc => doc.pages.flatMap(page => [...page.text.content.matchAll(/@UUID\[([^\]]+)\]/g)].map(match => match[1])));
  assert.ok(links.length > 300);
  for (const uuid of links) assert.ok(targets.has(uuid), `unknown canonical target ${uuid}`);
});

test("Identical names never justify dropping an ambiguous Ability occurrence", () => {
  assert.ok(built.coverage.unresolved.length > 0);
  for (const ambiguity of built.coverage.unresolved) {
    assert.ok(ambiguity.candidates.length > 1);
    assert.equal(built.coverage.destinations.find(target => ambiguity.paragraph >= target.start && ambiguity.paragraph <= target.end)?.kind, "journal");
  }
  const changed = structuredClone(paragraphs);
  changed.find(p => p.index === 642).text = "A different source revision";
  assert.throws(() => buildGenreChapters(changed, records), /boundary changed/);
});

test("Superhero Type cells keep their original table order, headings and values", () => {
  const cells = paragraphs.filter(p => p.index >= 457 && p.index <= 3437 && p.cell);
  assert.equal(cells.length, 24);
  const html = built.documents.find(doc => doc.flags.cypherFoundry.crd.logicalId === "journal.crd-superheroes").pages.map(page => page.text.content).join("\n");
  const table = html.match(/<table><tbody>[\s\S]*?<\/tbody><\/table>/)?.[0];
  assert.ok(table);
  let offset = 0;
  for (const cell of cells) {
    const next = visible(table).indexOf(plainText(cell.text), offset);
    assert.ok(next >= offset, `out-of-order table cell ${cell.index}`);
    offset = next + plainText(cell.text).length;
  }
  assert.equal((table.match(/<th>/g) ?? []).length, 3);
  assert.equal((table.match(/@UUID\[Compendium\.cypher\.types-en\.Item\./g) ?? []).length, 7);
});
