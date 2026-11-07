/** Practical help stays separate from source chapters and real controls remain traceable. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { readChapterReference } from "../../scripts/author-reference-chapters.mjs";
import { readReferenceCatalogue } from "../../scripts/crd-reference/catalogue.mjs";
import { readFrenchProposals } from "../../scripts/review-translations.mjs";
import { translationFields, translationSafetyErrors, sourceHash } from "../../scripts/localization/compendium-translations.mjs";
import { PLAYER_JOURNAL_IDS } from "../../scripts/library-player-metadata.mjs";
import { REFERENCE_JOURNAL_IDS } from "../../scripts/crd-reference/inventory.mjs";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
import { REFERENCE_SHA256 } from "../../scripts/crd-reference/creation-chapters.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const [paragraphs, records, proposals] = await Promise.all([readChapterReference(root), readReferenceCatalogue(root), readFrenchProposals(root)]);
const contract = JSON.parse(await fs.readFile(path.join(root, "data/library-player-resources.json")));
const digest = text => createHash("sha256").update(text).digest("hex");
const visible = html => plainText(html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1"));

test("Player guide and eight quick cards have distinct stable editorial identities and complete guarded EN/FR fields", () => {
  assert.deepEqual(contract.documents.map(d => d.logicalId), PLAYER_JOURNAL_IDS);
  assert.equal(contract.referenceSha256, REFERENCE_SHA256);
  assert.deepEqual(contract.documents.map(d => d.pages.length), [12, 8]);
  for (const entry of contract.documents) {
    assert.ok(!REFERENCE_JOURNAL_IDS.includes(entry.logicalId));
    const doc = records.find(r => r.logicalId === entry.logicalId).document;
    assert.equal(doc.flags.cypherFoundry.library.role, entry.role);
    assert.equal(doc.ownership.default, 2);
    const proposal = proposals.get(entry.logicalId).proposal;
    const fields = translationFields(doc);
    for (const p of entry.pages) for (const range of p.sources) {
      const source = paragraphs.filter(s => s.index >= range.start && s.index <= range.end && s.text.trim());
      assert.ok(source.length > 0, p.key);
      assert.equal(range.sourceSha256, digest(source.map(s => s.text).join("\n")));
    }
    assert.equal(fields.size, proposal.fields.length);
    for (const [field, english] of fields) {
      const french = proposal.fields.find(f => f.path === field);
      assert.ok(french, field);
      assert.equal(french.sourceHash, sourceHash(english), field);
      assert.deepEqual(translationSafetyErrors(english, french.text, field), []);
    }
  }
});

test("Every player page reaches readable complete CRD context through real native page identities", () => {
  for (const entry of contract.documents) {
    const doc = records.find(r => r.logicalId === entry.logicalId).document;
    for (const p of entry.pages) {
      const page = doc.pages.find(page => page._id === p.pageId);
      assert.ok(page, p.key);
      const links = [...page.text.content.matchAll(/@UUID\[Compendium\.cypher\.rules-en\.JournalEntry\.([^.]+)\.JournalEntryPage\.([^\]]+)\]/g)];
      assert.ok(links.length > 0, p.key);
      for (const [, id, pageId] of links) {
        const target = records.find(r => r.pack === "rules-en" && r.document._id === id);
        assert.ok(REFERENCE_JOURNAL_IDS.includes(target?.logicalId));
        assert.ok(target.document.pages.some(p => p._id === pageId));
      }
    }
  }
});

test("Quick cards preserve whole source paragraphs and ordered table cells under pinned CRD evidence", () => {
  const entry = contract.documents.find(d => d.role === "quick-reference");
  const doc = records.find(r => r.logicalId === entry.logicalId).document;
  for (const p of entry.pages) {
    const page = doc.pages.find(page => page._id === p.pageId), text = visible(page.text.content);
    const tables = new Set();
    for (const range of p.sources) {
      const source = paragraphs.filter(s => s.index >= range.start && s.index <= range.end && s.text.trim());
      for (const s of source) { assert.ok(text.includes(plainText(s.text)), `${p.key}: ${s.index}`); if (s.cell) tables.add(s.cell[0]); }
    }
    const rendered = [...page.text.content.matchAll(/<table><tbody>[\s\S]*?<\/tbody><\/table>/g)].map(m => m[0]);
    assert.equal(rendered.length, tables.size);
    for (const [i, index] of [...tables].entries()) {
      assert.deepEqual([...rendered[i].matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/g)].map(m => visible(m[1])),
        paragraphs.filter(s => s.cell?.[0] === index).map(s => plainText(s.text)));
    }
  }
});

test("Documented sheet actions exist in actual templates and registered PC controls", async () => {
  const pcSheet = await fs.readFile(path.join(root, "module/sheets/actor-pc-sheet.mjs"), "utf8");
  for (const entry of contract.documents) for (const p of entry.pages) for (const control of p.controls) {
    const template = await fs.readFile(path.join(root, control.template), "utf8");
    assert.ok(template.includes(`data-action="${control.action}"`), `${p.key}: ${control.action}`);
    if (control.template.startsWith("templates/actor/")) assert.ok(pcSheet.includes(control.action));
  }
});
