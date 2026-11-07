/** Deterministic first CRD chapter tranche. Source paragraphs stay verbatim;
 * complete existing definitions are linked, never paraphrased or duplicated.
 * Node authoring only: no Foundry globals and no implicit source-file writes.
 */
import { createHash } from "node:crypto";
import { GENRE_JOURNAL_IDS } from "./genre-metadata.mjs";
import { DETAIL_JOURNAL_IDS } from "./detail-metadata.mjs";
import { proposedFoundryId, proposedPageId, identitySlug } from "../source-migration/id-contract.mjs";
import { translationFields } from "../localization/compendium-translations.mjs";
import { plainText } from "../crd-audit/text-fidelity.mjs";

export const REFERENCE_SHA256 = "cbf439c9d6fc2c55860a8d0fa52a70be838522e66482d2706bd6ea3f6142c729";
export const CHAPTER_IDS = ["creating-your-character", "core-character", "skills", "descriptors", "contents"]
  .map(key => `journal.crd-${key}`);
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const digest = value => createHash("sha256").update(value, "utf8").digest("hex");

/** Build canonical IDs before writing so native links survive normalization. */
export function journal(key, name, start, end) {
  const logicalId = `journal.crd-${key}`, id = proposedFoundryId(logicalId);
  return { _id: id, _key: `!journal!${id}`, name, document: "JournalEntry", crdType: "journal",
    pages: [], ownership: { default: 2 }, flags: { cypherFoundry: { crd: {
      version: "2026-07-29", logicalId, language: "en", sourceKind: "section", section: name,
      sourceLocator: `CRD paragraphs ${start}-${end}`,
      transformations: ["Verbatim source paragraphs with structural HTML formatting",
        "Complete canonical Item definitions replaced by native compendium links; paragraph destinations recorded separately"]
    } } } };
}

/** Stable semantic anchors are independent of translated titles and page order. */
export function page(document, key, name, content) {
  const anchor = proposedFoundryId(`crd-page-anchor:${key}`);
  const id = proposedPageId(document.flags.cypherFoundry.crd.logicalId, anchor);
  const result = { _id: id, _key: `!journal.pages!${document._id}.${id}`, name,
    type: "text", sort: (document.pages.length + 1) * 100000, title: { show: true, level: 1 },
    text: { format: 1, content }, flags: { cypherFoundry: { identity: { sourcePageId: anchor } } } };
  document.pages.push(result);
  return result;
}

/** Native labels remain source-facing text; FR proposals translate the label,
 * while the compiler remaps the UUID to its paired French pack.
 */
export function link(logicalId, family, label, pageId = null) {
  const kind = family === "rules" ? "JournalEntry" : "Item";
  return `@UUID[Compendium.cypher.${family}-en.${kind}.${proposedFoundryId(logicalId)}${pageId ? `.JournalEntryPage.${pageId}` : ""}]{${escape(label)}}`;
}

/** Format complete source paragraphs; only structural markup changes. */
export function paragraphsHTML(paragraphs) {
  return paragraphs.filter(p => p.text.trim()).map(p => {
    const value = escape(p.text.trim());
    if (p.style === "Callout") return `<aside class="crd-callout"><p>${value}</p></aside>`;
    if (p.style === "Compact") return `<p class="crd-summary">${value}</p>`;
    if (/^(Heading[23]|H2)$/.test(p.style)) return `<h3>${value}</h3>`;
    return `<p>${value}</p>`;
  }).join("\n");
}

/**
 * @param {object[]} paragraphs Actual read-docx.py paragraphs, in source order.
 * @param {object[]} records English canonical source records (legacy IDs allowed).
 * @returns {{documents: object[], coverage: object}} Validated authoring output.
 * Fails before returning if any nonblank paragraph lacks an exact destination.
 */
export function buildCreationChapters(paragraphs, records) {
  const at = index => paragraphs.find(p => p.index === index);
  const slice = (start, end) => paragraphs.filter(p => p.index >= start && p.index <= end);
  for (const [index, title] of [[1, "Creating Your Character"], [50, "The Core Character"], [64, "Skills"], [247, "Descriptors"], [457, "The Real World Genre"]]) {
    if (at(index)?.text.trim() !== title) throw new Error(`CRD chapter boundary changed at ${index}`);
  }
  const documents = [], destinations = [], assigned = new Set();
  function assign(start, end, document, targetPage = null, kind = "journal") {
    const selected = slice(start, end).filter(p => p.text.trim());
    for (const p of selected) {
      if (assigned.has(p.index)) throw new Error(`Duplicate CRD paragraph destination ${p.index}`);
      assigned.add(p.index);
    }
    destinations.push({ start, end, logicalId: document.flags.cypherFoundry.crd.logicalId,
      ...(targetPage ? { pageId: targetPage._id } : {}), kind,
      sourceSha256: digest(selected.map(p => p.text).join("\n")) });
  }
  function sourcePage(document, key, name, start, end, content = null) {
    const result = page(document, key, name, content ?? paragraphsHTML(slice(start, end)));
    assign(start, end, document, result);
    return result;
  }
  const creation = journal("creating-your-character", at(1).text, 1, 49);
  assign(1, 1, creation);
  sourcePage(creation, "creation-overview", at(1).text, 2, 2);
  const headings = slice(3, 49).filter(p => p.style === "Heading2");
  for (const [index, heading] of headings.entries()) {
    const end = headings[index + 1]?.index - 1 || 49;
    sourcePage(creation, `creation-${identitySlug(heading.text)}`, heading.text,
      heading.index, end, paragraphsHTML(slice(heading.index + 1, end)));
  }
  documents.push(creation);

  const core = journal("core-character", at(50).text, 50, 63);
  assign(50, 50, core);
  sourcePage(core, "core-summary", at(51).text, 51, 63, paragraphsHTML(slice(52, 63)));
  documents.push(core);

  const skills = journal("skills", at(64).text, 64, 246);
  assign(64, 64, skills);
  sourcePage(skills, "skill-principles", at(64).text, 65, 75);
  sourcePage(skills, "background-skills", "Background Skills", 76, 79);
  sourcePage(skills, "tier-restricted-skills", "Tier-Restricted Skills", 80, 87,
    paragraphsHTML(slice(80, 83)) + '\n<table><thead><tr><th>Tier</th><th>Skill</th></tr></thead><tbody>'
    + slice(85, 87).map(p => { const [tier, ...words] = p.text.trim().split(/\s+/); return `<tr><td>${tier}</td><td>${escape(words.join(" "))}</td></tr>`; }).join("") + "</tbody></table>");
  const skillRecords = records.filter(row => row.pack === "skills-en");
  function byName(rows, name) {
    const matches = rows.filter(row => row.document.name.toLowerCase() === name.toLowerCase());
    if (matches.length !== 1) throw new Error(`Missing or ambiguous canonical definition: ${name}`);
    const row = matches[0];
    if (row.document.flags?.cypherFoundry?.crd?.logicalId) return row.document;
    // Legacy standard Descriptors acquire identity from their English filename
    // in normalizeDescriptorSources. Mirror that existing input contract only;
    // localized titles and species folders are never fallback identities.
    const legacy = /^packs\/descriptors-en\/_source\/standard\/([^/]+)\.json$/.exec(row.file);
    if (!legacy) throw new Error(`Missing canonical source identity: ${row.file}`);
    const document = structuredClone(row.document);
    document.flags ??= {};
    document.flags.cypherFoundry ??= {};
    document.flags.cypherFoundry.crd = { logicalId: `descriptor.${identitySlug(legacy[1])}` };
    return document;
  }
  function linkedList(start, end, rows, family) {
    return "<ul>" + slice(start, end).filter(p => p.text.trim()).map(p => {
      const name = p.text.trim().replace(/ \(tier-restricted\)$/, "");
      const item = byName(rows, name);
      return `<li>${link(item.flags.cypherFoundry.crd.logicalId, family, p.text.trim())}</li>`;
    }).join("") + "</ul>";
  }
  sourcePage(skills, "master-skill-list", at(88).text.trim(), 88, 148,
    paragraphsHTML(slice(89, 90)) + "\n" + linkedList(91, 148, skillRecords, "skills"));
  // A source-locked exact comparison proves that whole definition/callout blocks
  // are present in the linked Items; a partial text hit cannot close a block.
  function itemBlock(start, end, item, stripName = false) {
    const fields = [...translationFields(item).values()].map(plainText);
    for (const p of slice(start, end).filter(p => p.text.trim())) {
      const value = plainText(stripName && p.index === start ? p.text.slice(p.text.indexOf(":") + 1) : p.text);
      if (!fields.some(field => field.includes(value))) throw new Error(`Incomplete canonical Item ${item.name}: CRD paragraph ${p.index}`);
    }
    assign(start, end, item, null, "canonical-item");
  }
  const skillStarts = slice(150, 245).filter(p => p.style === "BodyText" &&
    skillRecords.some(row => p.text.startsWith(row.document.name + ":") || p.text.startsWith(row.document.name + " (tier restricted):")));
  for (const [index, p] of skillStarts.entries()) {
    const name = p.text.slice(0, p.text.indexOf(":")).replace(/ \(tier restricted\)$/, "");
    itemBlock(p.index, (skillStarts[index + 1]?.index ?? 246) - 1, byName(skillRecords, name), true);
  }
  documents.push(skills);

  const descriptors = journal("descriptors", at(247).text, 247, 456);
  assign(247, 247, descriptors);
  sourcePage(descriptors, "descriptor-principles", at(247).text, 248, 254);
  const descriptorRecords = records.filter(row => row.pack === "descriptors-en");
  sourcePage(descriptors, "descriptors-list", at(255).text, 255, 289,
    linkedList(256, 289, descriptorRecords, "descriptors"));
  const descriptorStarts = slice(291, 456).filter(p => p.style === "Heading3" && p.text.trim());
  for (const [index, p] of descriptorStarts.entries()) {
    itemBlock(p.index, (descriptorStarts[index + 1]?.index ?? 457) - 1, byName(descriptorRecords, p.text));
  }
  documents.push(descriptors);

  const contents = journal("contents", "CRD Contents and Thematic Index", 1, 456);
  const genres = GENRE_JOURNAL_IDS.map(id => records.find(row => row.logicalId === id)?.document).filter(Boolean);
  const details = DETAIL_JOURNAL_IDS.map(id => records.find(row => row.logicalId === id)?.document).filter(Boolean);
  const referenceChapters = [...genres, ...details];
  const navigable = [...documents, ...referenceChapters];
  contents.flags.cypherFoundry.crd.sourceLocator = `Editorial navigation to CRD paragraphs 1-${details.length ? 5952 : genres.length ? 3437 : 456}`;
  contents.flags.cypherFoundry.crd.transformations = ["Editorial contents and thematic links to source-backed Journals; no replacement rule text"];
  page(contents, "reference-contents", "Contents", "<p>Reference chapters available in this edition:</p><ol>"
    + navigable.map(doc => `<li>${link(doc.flags.cypherFoundry.crd.logicalId, "rules", doc.name)}<ul>`
      + doc.pages.map(entry => `<li>${link(doc.flags.cypherFoundry.crd.logicalId, "rules", entry.name, entry._id)}</li>`).join("") + "</ul></li>").join("")
    + "</ol><p>The remaining CRD chapters are being prepared. The existing quick references remain available from the library.</p>");
  page(contents, "reference-thematic-index", "Thematic Index", "<ul>" + [
    [creation, "creation-your-three-stats", "Stats, Pools and Edge"],
    [creation, "creation-wounds", "Wounds"], [creation, "creation-effort", "Effort"],
    [creation, "creation-cyphers", "Cyphers"], [creation, "creation-recoveries", "Recoveries"],
    [core, "core-summary", "Core character summary"], [skills, "background-skills", "Background Skills"],
    [skills, "tier-restricted-skills", "Tier-Restricted Skills"], [skills, "master-skill-list", "Master Skill List"],
    [descriptors, "descriptor-principles", "Choosing a descriptor"]
  ].map(([doc, key, title]) => {
    const target = doc.pages.find(entry => entry.flags.cypherFoundry.identity.sourcePageId === proposedFoundryId(`crd-page-anchor:${key}`));
    if (!target) throw new Error(`Missing thematic destination: ${key}`);
    return `<li>${link(doc.flags.cypherFoundry.crd.logicalId, "rules", title, target._id)}</li>`;
  }).join("") + referenceChapters.map(doc => `<li>${link(doc.flags.cypherFoundry.crd.logicalId, "rules", doc.name, doc.pages[0]._id)}</li>`).join("") + "</ul>");
  documents.push(contents);
  const missing = slice(1, 456).filter(p => p.text.trim() && !assigned.has(p.index));
  if (missing.length) throw new Error(`Unassigned source paragraphs: ${missing.map(p => p.index).join(", ")}`);
  return { documents, coverage: { schemaVersion: 1, referenceSha256: REFERENCE_SHA256,
    scope: "Information library lot 2A: CRD chapters 1–4", sourceRange: [1, 456],
    nonblankParagraphs: assigned.size, journalIds: documents.map(doc => doc.flags.cypherFoundry.crd.logicalId),
    destinations } };
}
