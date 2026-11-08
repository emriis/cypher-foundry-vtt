/** Editorial GM routes stay grounded in source evidence and existing controls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { readChapterReference } from "../../scripts/author-reference-chapters.mjs";
import { readReferenceCatalogue } from "../../scripts/crd-reference/catalogue.mjs";
import { readFrenchProposals } from "../../scripts/review-translations.mjs";
import { translationFields, translationSafetyErrors, sourceHash } from "../../scripts/localization/compendium-translations.mjs";
import { GM_JOURNAL_IDS } from "../../scripts/library-gm-metadata.mjs";
import { PLAYER_JOURNAL_IDS } from "../../scripts/library-player-metadata.mjs";
import { REFERENCE_JOURNAL_IDS } from "../../scripts/crd-reference/inventory.mjs";
import { REFERENCE_SHA256 } from "../../scripts/crd-reference/creation-chapters.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const [paragraphs, records, proposals] = await Promise.all([readChapterReference(root), readReferenceCatalogue(root), readFrenchProposals(root)]);
const contract = JSON.parse(await fs.readFile(path.join(root, "data/library-gm-resources.json")));

test("GM guide and screen have separate editorial identities, pinned evidence and complete EN/FR fields", () => {
  assert.deepEqual(contract.documents.map(d => d.logicalId), GM_JOURNAL_IDS);
  assert.equal(contract.referenceSha256, REFERENCE_SHA256);
  assert.deepEqual(contract.documents.map(d => d.pages.length), [12, 8]);
  for (const entry of contract.documents) {
    assert.ok(![...REFERENCE_JOURNAL_IDS, ...PLAYER_JOURNAL_IDS].includes(entry.logicalId));
    const doc = records.find(r => r.logicalId === entry.logicalId).document;
    assert.equal(doc.flags.cypherFoundry.library.role, entry.role);
    assert.equal(doc.ownership.default, 2);
    const proposal = proposals.get(entry.logicalId).proposal;
    const fields = translationFields(doc);
    assert.equal(fields.size, proposal.fields.length);
    for (const p of entry.pages) for (const range of p.sources) {
      const source = paragraphs.filter(s => s.index >= range.start && s.index <= range.end && s.text.trim());
      assert.ok(source.length > 0, p.key);
      assert.equal(range.sourceSha256, createHash("sha256").update(source.map(s => s.text).join("\n")).digest("hex"));
    }
    for (const [field, english] of fields) {
      const french = proposal.fields.find(f => f.path === field);
      assert.ok(french, field);
      assert.equal(french.sourceHash, sourceHash(english), field);
      assert.deepEqual(translationSafetyErrors(english, french.text, field), []);
    }
  }
});

test("Every GM page links actual complete CRD context and the screen reaches all twelve procedures", () => {
  const guide = records.find(r => r.logicalId === "journal.gm-guide").document;
  const reached = new Set();
  for (const entry of contract.documents) {
    const doc = records.find(r => r.logicalId === entry.logicalId).document;
    for (const p of entry.pages) {
      const page = doc.pages.find(page => page._id === p.pageId);
      assert.ok(page, p.key);
      const links = [...page.text.content.matchAll(/@UUID\[Compendium\.cypher\.rules-en\.JournalEntry\.([^.]+)\.JournalEntryPage\.([^\]]+)\]/g)];
      let sourceCount = 0;
      for (const [, id, pageId] of links) {
        const target = records.find(r => r.pack === "rules-en" && r.document._id === id);
        assert.ok(target?.document.pages.some(p => p._id === pageId), `${p.key}: ${pageId}`);
        if (REFERENCE_JOURNAL_IDS.includes(target.logicalId)) sourceCount++;
        if (entry.logicalId === "journal.gm-screen" && target.logicalId === "journal.gm-guide") reached.add(pageId);
      }
      assert.ok(sourceCount > 0, p.key);
      // Published procedural content must not smuggle executable gameplay controls.
      assert.doesNotMatch(page.text.content, /<script|data-action=|javascript:/i);
    }
  }
  assert.deepEqual([...reached].sort(), guide.pages.map(p => p._id).sort());
});

test("GM procedure control references still resolve to registered actions and actual templates", async () => {
  const sheets = await Promise.all(["actor-pc-sheet", "actor-npc-sheet", "actor-object-sheet", "library"]
    .map(name => fs.readFile(path.join(root, `module/sheets/${name}.mjs`), "utf8")));
  for (const entry of contract.documents) for (const p of entry.pages) for (const control of p.controls) {
    const template = await fs.readFile(path.join(root, control.template), "utf8");
    assert.ok(template.includes(`data-action="${control.action}"`), `${p.key}: ${control.action}`);
    assert.ok(sheets.some(sheet => sheet.includes(control.action)), control.action);
  }
  const header = await fs.readFile(path.join(root, "templates/actor/parts/header.hbs"), "utf8");
  assert.ok(header.includes('name="system.xp"'), "Manual story XP instructions require a real editable field");
});
