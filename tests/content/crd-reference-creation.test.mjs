/** First four chapters are a complete source partition, not a selection of matches. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { readChapterReference, authorReferenceChapters } from "../../scripts/author-reference-chapters.mjs";
import { buildCreationChapters } from "../../scripts/crd-reference/creation-chapters.mjs";
import { readCompendiumCatalogue } from "../../scripts/review-translations.mjs";
import { proposedFoundryId, proposedPageId } from "../../scripts/source-migration/id-contract.mjs";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const [paragraphs, records] = await Promise.all([readChapterReference(root), readCompendiumCatalogue(root, { languages: ["en"] })]);

test("Every nonblank paragraph in chapters 1–4 has one complete source-backed destination", async () => {
  const { documents, coverage } = await authorReferenceChapters(root);
  assert.equal(documents.length, 5);
  assert.equal(coverage.nonblankParagraphs, 446);
  const seen = new Set();
  for (const target of coverage.destinations) for (const p of paragraphs.filter(p => p.index >= target.start && p.index <= target.end && p.text.trim())) {
    assert.ok(!seen.has(p.index), `duplicate paragraph ${p.index}`); seen.add(p.index);
    if (target.kind !== "journal") continue;
    const document = documents.find(doc => doc.flags.cypherFoundry.crd.logicalId === target.logicalId);
    const page = document.pages.find(page => page._id === target.pageId);
    const fields = page ? `${page.name} ${page.text.content}` : document.name;
    // Native links preserve complete labels while their bodies stay canonical.
    const text = plainText(fields.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1"));
    assert.ok(text.includes(plainText(p.text)), `incomplete Journal paragraph ${p.index}`);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), paragraphs.filter(p => p.index >= 1 && p.index <= 456 && p.text.trim()).map(p => p.index));
});

test("Whole Skill callouts and Descriptor benefit blocks must exist in the linked canonical Item", () => {
  const modified = structuredClone(records);
  const item = modified.find(row => row.document.name === "Disguise").document;
  item.system.description = "<p>A fragment of the disguise skill.</p>";
  assert.throws(() => buildCreationChapters(paragraphs, modified), /Incomplete canonical Item Disguise/);
  const changed = structuredClone(paragraphs);
  changed.find(p => p.index === 247).text = "Different chapter";
  assert.throws(() => buildCreationChapters(changed, records), /boundary changed/);
});

test("Chapter/page identities and every native link resolve to stable canonical destinations", () => {
  const { documents } = buildCreationChapters(paragraphs, records);
  const targets = new Set(records.filter(row => row.logicalId).map(row => `Compendium.cypher.${row.pack}.${row.document.document === "JournalEntry" ? "JournalEntry" : "Item"}.${proposedFoundryId(row.logicalId)}`));
  // Legacy standard Descriptor IDs come from the existing canonical filename contract.
  for (const row of records.filter(row => /^packs\/descriptors-en\/_source\/standard\//.test(row.file))) targets.add(`Compendium.cypher.descriptors-en.Item.${proposedFoundryId(`descriptor.${path.basename(row.file, ".json")}`)}`);
  for (const doc of documents) {
    const id = doc.flags.cypherFoundry.crd.logicalId;
    assert.equal(doc._id, proposedFoundryId(id));
    targets.add(`Compendium.cypher.rules-en.JournalEntry.${doc._id}`);
    for (const page of doc.pages) {
      assert.equal(page._id, proposedPageId(id, page.flags.cypherFoundry.identity.sourcePageId));
      targets.add(`Compendium.cypher.rules-en.JournalEntry.${doc._id}.JournalEntryPage.${page._id}`);
    }
  }
  let skills = 0, descriptors = 0;
  for (const doc of documents) for (const page of doc.pages) for (const [, uuid] of page.text.content.matchAll(/@UUID\[([^\]]+)\]/g)) {
    assert.ok(targets.has(uuid), `unresolved ${uuid}`);
    if (uuid.includes("skills-en")) skills++;
    if (uuid.includes("descriptors-en")) descriptors++;
  }
  assert.equal(skills, 58); assert.equal(descriptors, 33);
});

test("Chapter coverage resolves five outstanding callout groups and preserves the source table in its canonical Skill", async () => {
  const { coverage } = buildCreationChapters(paragraphs, records);
  for (const [start, end] of [[26, 26], [63, 63], [83, 87], [168, 171], [253, 254]]) {
    for (let index = start; index <= end; index++) assert.ok(coverage.destinations.some(target => index >= target.start && index <= target.end), `missing callout ${index}`);
  }
  const stored = JSON.parse(await fs.readFile(path.join(root, "data/crd-reference-creation.json"), "utf8"));
  assert.equal(stored.referenceSha256, coverage.referenceSha256);
  assert.equal(paragraphs.filter(p => p.index <= 456 && p.cell !== null).length, 10);
  assert.ok(coverage.destinations.some(target => target.logicalId === "skill.scavenging" && target.start <= 228 && target.end >= 237));
  const scavenging = records.find(row => row.logicalId === "skill.scavenging").document;
  assert.match(scavenging.system.description, /<table>/);
});
