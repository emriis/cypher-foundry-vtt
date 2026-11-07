/** Full source coverage, scoped references and complete Word tables for lot 2C. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { readChapterReference } from "../../scripts/author-reference-chapters.mjs";
import { readReferenceCatalogue } from "../../scripts/crd-reference/catalogue.mjs";
import { buildDetailChapters } from "../../scripts/crd-reference/detail-chapters.mjs";
import { authorDetailChapters } from "../../scripts/author-detail-chapters.mjs";
import { translationFields } from "../../scripts/localization/compendium-translations.mjs";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
import { readFrenchProposals } from "../../scripts/review-translations.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const [paragraphs, records] = await Promise.all([readChapterReference(root), readReferenceCatalogue(root)]);
const built = buildDetailChapters(paragraphs, records);
const visible = html => plainText(html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1"));

test("Foci and equipment give every nonblank source paragraph one complete destination", () => {
  const expected = paragraphs.filter(p => p.index >= 3438 && p.index <= 5952 && p.text.trim());
  assert.equal(built.coverage.nonblankParagraphs, expected.length);
  assert.deepEqual(built.documents.map(doc => doc.pages.length), [46, 13]);
  const seen = [];
  for (const doc of built.documents) assert.equal(new Set(doc.pages.map(page => page._id)).size, doc.pages.length);
  for (const target of built.coverage.destinations) {
    const source = expected.filter(p => p.index >= target.start && p.index <= target.end);
    assert.equal(target.sourceSha256, createHash("sha256").update(source.map(p => p.text).join("\n")).digest("hex"));
    const document = built.documents.find(doc => doc.flags.cypherFoundry.crd.logicalId === target.logicalId);
    const page = document?.pages.find(page => page._id === target.pageId);
    const text = target.kind === "journal" ? visible(page.name + " " + page.text.content)
      : plainText(translationFields(records.find(row => row.logicalId === target.logicalId).document).get(target.field));
    for (const paragraph of source) {
      assert.ok(text.includes(plainText(target.strippedPrefix ? paragraph.text.trim().slice(target.strippedPrefix.length) : paragraph.text)), `missing ${paragraph.index}`);
      seen.push(paragraph.index);
    }
  }
  assert.deepEqual(seen, expected.map(p => p.index));
});

test("All 26 tables preserve their cell order and their 31 empty note cells", () => {
  assert.equal(built.coverage.tables.length, 26);
  assert.equal(built.coverage.tables.reduce((n, table) => n + table.cells, 0), 674);
  assert.equal(built.coverage.tables.reduce((n, table) => n + table.blankParagraphs, 0), 31);
  const html = built.documents.flatMap(doc => doc.pages.map(page => page.text.content)).join("\n");
  const rendered = [...html.matchAll(/<table><tbody>[\s\S]*?<\/tbody><\/table>/g)].map(match => match[0]);
  assert.equal(rendered.length, 26);
  for (const [ordinal, table] of built.coverage.tables.entries()) {
    const cells = paragraphs.filter(p => p.cell?.[0] === table.index);
    const displayed = [...rendered[ordinal].matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/g)].map(match => visible(match[1]));
    assert.deepEqual(displayed, cells.map(p => plainText(p.text)), `table ${table.index}`);
  }
});

test("Equipment tables link all 259 distinct genre/price/name identities and Foci reach all 42 native graphs", () => {
  const [foci, equipment] = built.documents;
  const links = doc => [...doc.pages.map(page => page.text.content).join("\n").matchAll(/@UUID\[([^\]]+)\]/g)].map(match => match[1]);
  const actual = links(equipment);
  const expected = records.filter(row => row.logicalId.startsWith("equipment.")).map(row => `Compendium.cypher.equipment-en.Item.${row.document._id}`);
  assert.equal(actual.length, 259);
  assert.deepEqual([...new Set(actual)].sort(), expected.sort());
  const focusLinks = new Set(links(foci).filter(uuid => uuid.includes("foci-en")));
  assert.equal(focusLinks.size, 42);
  for (const row of records.filter(row => row.pack === "foci-en")) {
    assert.ok(focusLinks.has(`Compendium.cypher.foci-en.Item.${row.document._id}`));
    assert.ok(row.document.system.flowchart.edges.length > 0);
  }
});

test("Authoring checks reproduce both Journals and reject missing table destinations", async () => {
  await authorDetailChapters(root);
  const removed = records.filter(row => row.logicalId !== "equipment.real-world.veryexpensive.assault-rifle");
  assert.throws(() => buildDetailChapters(paragraphs, removed), /Missing or ambiguous equipment table destination at 5415/);
  const changed = structuredClone(paragraphs);
  changed.find(p => p.index === 5230).text = "Different chapter";
  assert.throws(() => buildDetailChapters(changed, records), /boundary changed/);
});

test("French native reference costs translate Pool-choice conjunctions as well as labels", async () => {
  const proposals = await readFrenchProposals(root);
  for (const [id, { proposal }] of proposals) if (id.startsWith("journal.crd-")) {
    for (const field of proposal.fields) for (const [, label] of field.text.matchAll(/@UUID\[[^\]]+\]\{([^}]+)\}/g)) {
      assert.doesNotMatch(label, /\d+\+? (?:Intellect|Puissance|Célérité|Might|Speed) or /, `${id}: ${label}`);
    }
  }
});
