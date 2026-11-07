/** Source fidelity and native navigation for the complete Cypher reference. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { readChapterReference } from "../../scripts/author-reference-chapters.mjs";
import { readReferenceCatalogue } from "../../scripts/crd-reference/catalogue.mjs";
import { buildCypherChapter } from "../../scripts/crd-reference/cypher-chapter.mjs";
import { authorCypherChapter } from "../../scripts/author-cypher-chapter.mjs";
import { translationFields } from "../../scripts/localization/compendium-translations.mjs";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const [paragraphs, records] = await Promise.all([readChapterReference(root), readReferenceCatalogue(root)]);
const built = buildCypherChapter(paragraphs, records);
const document = built.documents[0];
const visible = html => plainText(html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1"));

test("Cypher references give each CRD paragraph exactly one complete, source-hashed destination", () => {
  const expected = paragraphs.filter(p => p.index >= 5955 && p.index <= 7380 && p.text.trim());
  assert.equal(expected.length, 1202);
  assert.equal(built.coverage.nonblankParagraphs, expected.length);
  assert.equal(document.pages.length, 22);
  assert.equal(new Set(document.pages.map(p => p._id)).size, 22);
  const seen = [];
  for (const target of built.coverage.destinations) {
    const source = expected.filter(p => p.index >= target.start && p.index <= target.end);
    assert.equal(target.sourceSha256, createHash("sha256").update(source.map(p => p.text).join("\n")).digest("hex"));
    const page = document.pages.find(p => p._id === target.pageId);
    const text = target.kind === "journal" ? visible(page.name + " " + page.text.content)
      : plainText(translationFields(records.find(row => row.logicalId === target.logicalId).document).get(target.field));
    for (const p of source) { assert.ok(text.includes(plainText(p.text)), `Missing paragraph ${p.index}`); seen.push(p.index); }
  }
  assert.deepEqual(seen, expected.map(p => p.index));
});

test("All eleven Cypher tables retain 691 cells including 208 blank cells and variant labels", () => {
  const tables = built.coverage.tables;
  assert.deepEqual(tables.map(t => t.index), Array.from({ length: 11 }, (_, i) => i + 28));
  assert.equal(tables.reduce((n, t) => n + t.cells, 0), 691);
  assert.equal(tables.reduce((n, t) => n + t.blankParagraphs, 0), 208);
  const html = document.pages.map(p => p.text.content).join("\n");
  const rendered = [...html.matchAll(/<table><tbody>[\s\S]*?<\/tbody><\/table>/g)].map(m => m[0]);
  assert.equal(rendered.length, 11);
  for (const [i, table] of tables.entries()) {
    const cells = paragraphs.filter(p => p.cell?.[0] === table.index);
    assert.deepEqual([...rendered[i].matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/g)].map(m => visible(m[1])), cells.map(p => plainText(p.text)));
  }
  assert.match(html, /\]\{Teleporter \(bounder\)\}/);
  assert.match(html, /\]\{Teleporter \(interstellar\)\}/);
});

test("The three Cypher catalogues reach all 198 Items and generation links point to source pages", () => {
  const actual = built.coverage.definitions.map(d => d.logicalId);
  assert.equal(new Set(actual).size, 198);
  assert.deepEqual([...actual].sort(), records.filter(r => r.document.type === "cypher").map(r => r.logicalId).sort());
  const html = document.pages.map(p => p.text.content).join("\n");
  for (const id of actual) {
    const row = records.find(r => r.logicalId === id);
    assert.ok(html.includes(`Compendium.cypher.equipment-en.Item.${row.document._id}`));
  }
  const nativePages = [...html.matchAll(/\.JournalEntryPage\.([^\]]+)\]/g)].map(m => m[1]);
  assert.equal(nativePages.length, 6);
  for (const id of nativePages) assert.ok(document.pages.some(p => p._id === id));
});

test("Authoring reproduces the chapter and fails closed on missing definitions or changed source boundaries", async () => {
  await authorCypherChapter(root);
  assert.throws(() => buildCypherChapter(paragraphs, records.filter(r => r.logicalId !== "cypher.manifest.teleporter")), /Missing or ambiguous Cypher destination/);
  const changed = structuredClone(paragraphs);
  changed.find(p => p.index === 7381).text = "Different chapter";
  assert.throws(() => buildCypherChapter(changed, records), /boundary changed/);
});
