/** The final source tranche and cross-tranche completeness are independent checks. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { readChapterReference } from "../../scripts/author-reference-chapters.mjs";
import { buildFinalChapters } from "../../scripts/crd-reference/final-chapters.mjs";
import { authorFinalChapters } from "../../scripts/author-final-chapters.mjs";
import { checkReferenceCompleteness } from "../../scripts/check-reference-completeness.mjs";
import { buildReferenceCompleteness, PARTITION_FILES } from "../../scripts/crd-reference/completeness.mjs";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const paragraphs = await readChapterReference(root), built = buildFinalChapters(paragraphs);
const visible = html => plainText(html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1"));

test("Final chapters preserve all 784 source paragraphs including the front title and complete publisher credits", () => {
  assert.deepEqual(built.documents.map(d => d.pages.length), [27, 18, 3]);
  const expected = paragraphs.filter(p => (p.index === 0 || p.index >= 7381) && p.text.trim()), seen = [];
  assert.equal(expected.length, 784);
  for (const target of built.coverage.destinations) {
    const source = expected.filter(p => p.index >= target.start && p.index <= target.end);
    assert.equal(target.sourceSha256, createHash("sha256").update(source.map(p => p.text).join("\n")).digest("hex"));
    const doc = built.documents.find(d => d.flags.cypherFoundry.crd.logicalId === target.logicalId);
    const page = doc.pages.find(p => p._id === target.pageId), text = visible(page.name + " " + page.text.content);
    for (const p of source) { assert.ok(text.includes(plainText(p.text)), `Missing paragraph ${p.index}`); seen.push(p.index); }
  }
  assert.deepEqual(seen, expected.map(p => p.index));
  assert.match(built.documents[2].pages[0].text.content, /not this unofficial Foundry conversion/);
  assert.match(built.documents[2].pages[2].text.content, /This product is an independent production/);
  assert.doesNotMatch(built.documents[2].pages[2].text.content, /<a\b[^>]+href="([^"]+)"[^>]*>\1<\/a>/,
    "Use a descriptive label to avoid Foundry enriching a URL inside an existing anchor");
});

test("The final 22 consultation tables preserve all 190 source cells in order", () => {
  assert.deepEqual(built.coverage.tables.map(t => t.index), Array.from({ length: 22 }, (_, i) => i + 39));
  const html = built.documents.flatMap(d => d.pages.map(p => p.text.content)).join("\n");
  const rendered = [...html.matchAll(/<table><tbody>[\s\S]*?<\/tbody><\/table>/g)].map(m => m[0]);
  assert.equal(rendered.length, 22);
  assert.equal(built.coverage.tables.reduce((n, t) => n + t.cells, 0), 190);
  for (const [i, table] of built.coverage.tables.entries()) {
    const cells = new Map();
    for (const p of paragraphs.filter(p => p.cell?.[0] === table.index)) {
      const key = p.cell.slice(1).join(":");
      cells.set(key, [...(cells.get(key) ?? []), p.text]);
    }
    assert.deepEqual([...rendered[i].matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/g)].map(m => visible(m[1])),
      [...cells.values()].map(texts => plainText(texts.join(" "))));
  }
  // Word table 55 puts two separate statements in its final cell.
  assert.match(rendered[16], /very dense mist \(as darkness\)<br>Attacker underwater/);
  const pageIds = new Set(built.documents.flatMap(d => d.pages.map(p => p._id)));
  const links = [...html.matchAll(/\.JournalEntryPage\.([^\]]+)\]/g)];
  assert.equal(links.length, 12);
  for (const [, id] of links) assert.ok(pageIds.has(id));
});

test("Final authoring is reproducible and rejects changed headings or document extent", async () => {
  await authorFinalChapters(root);
  const changed = structuredClone(paragraphs);
  changed.find(p => p.index === 7986).text = "Different chapter";
  assert.throws(() => buildFinalChapters(changed), /boundary changed/);
  assert.throws(() => buildFinalChapters(paragraphs.slice(0, -1)), /extent/);
});

test("All tranches cover the full CRD, 61 tables and 100 historical groups without missing or duplicate source destinations", async () => {
  const report = await checkReferenceCompleteness(root);
  assert.equal(report.nonblankParagraphs, paragraphs.filter(p => p.text.trim()).length);
  assert.equal(report.tables.length, 61);
  assert.equal(report.visualGroups.length, 100);
  assert.deepEqual(report.missingParagraphs, []);
  assert.deepEqual(report.duplicateParagraphs, []);
  const partitions = await Promise.all(PARTITION_FILES.map(async file => JSON.parse(await fs.readFile(path.join(root, file)))));
  const baseline = await fs.readFile(path.join(root, "docs/crd-reference-destinations.md"), "utf8");
  assert.throws(() => buildReferenceCompleteness(paragraphs, partitions.slice(0, -1), baseline), /Missing source destination/);
  assert.throws(() => buildReferenceCompleteness(paragraphs, [...partitions, partitions[0]], baseline), /Duplicate source destination/);
  const changed = structuredClone(partitions);
  changed[0].destinations[0].sourceSha256 = "0".repeat(64);
  assert.throws(() => buildReferenceCompleteness(paragraphs, changed, baseline), /source drift/);
});
