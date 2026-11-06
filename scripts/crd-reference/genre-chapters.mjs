/** Source-locked genre references. A paragraph is omitted from Journal prose
 * only when its whole text has a bounded canonical destination. A shared name
 * or a partial match never proves equivalence between two Ability occurrences.
 */
import { createHash } from "node:crypto";
import { journal, page, link, paragraphsHTML, REFERENCE_SHA256 } from "./creation-chapters.mjs";
import { identitySlug } from "../source-migration/id-contract.mjs";
import { translationFields } from "../localization/compendium-translations.mjs";
import { plainText } from "../crd-audit/text-fidelity.mjs";
import { auditAbilityBaseCost } from "../crd-audit/source-fields.mjs";
import { GENRE_CHAPTERS, GENRE_JOURNAL_IDS } from "./genre-metadata.mjs";
export { GENRE_CHAPTERS, GENRE_JOURNAL_IDS } from "./genre-metadata.mjs";

const digest = text => createHash("sha256").update(text, "utf8").digest("hex");
const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const regexp = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** @returns {{documents:object[],coverage:object}} Pure authoring output.
 * records must be normalized English definitions; callers own isolated reads.
 */
export function buildGenreChapters(paragraphs, records) {
  const definitions = records.filter(row => ["types-en", "descriptors-en", "abilities-en", "skills-en", "foci-en"].includes(row.pack));
  const fields = new Map(definitions.map(row => [row.logicalId, [...translationFields(row.document)].map(([field, value]) => ({ field, text: plainText(value) }))]));
  const byUUID = new Map(definitions.map(row => [`Compendium.cypher.${row.pack}.Item.${row.document._id}`, row]));
  const types = definitions.filter(row => row.pack === "types-en");
  const species = definitions.filter(row => row.logicalId.startsWith("descriptor.species."));
  const abilities = definitions.filter(row => row.pack === "abilities-en");
  const names = [...new Set(abilities.map(row => row.document.name))].sort((a, b) => b.length - a.length);
  const abilityHeader = new RegExp(`^(${names.map(regexp).join("|")})(?: \\([^:]*\\))?:`);
  const destinations = [], documents = [], unresolved = [];
  let type = null, activeAbility = null, abilityLabel = null, listContext = null;

  function listFor(text) {
    if (/skills$/i.test(text)) return "skills";
    if (/foci/i.test(text) && /Suggested|Options|Foci$/.test(text)) return "foci";
    if (/Species(?: Options)?$/.test(text)) return "species";
    if (/Types(?: for Historical Settings)?$/.test(text)) return "types";
    return null;
  }

  function prove(row, paragraph, prefix = "") {
    const text = plainText(prefix ? paragraph.text.slice(prefix.length) : paragraph.text);
    if (!text) return null;
    const match = fields.get(row.logicalId).find(field => field.text.includes(text));
    return match ? { logicalId: row.logicalId, field: match.field, ...(prefix ? { strippedPrefix: prefix } : {}) } : null;
  }
  function typeFor(p) {
    const name = p.text.trim();
    const matches = types.filter(row => row.document.name === name && p.section.includes(row.document.system.subgenre));
    return matches.length === 1 ? matches[0] : null;
  }
  function reference(p) {
    // These occurrences name their originating subgenre explicitly in the
    // CRD. Reuse that definition rather than the adapted same-name Type.
    const crossGenreTypes = { 1168: "type.barbarian", 1548: "type.archer",
      2249: "type.diplomat", 2250: "type.medic", 2254: "type.soldier" };
    if (crossGenreTypes[p.index]) {
      const target = types.find(row => row.logicalId === crossGenreTypes[p.index]);
      if (!target) throw new Error(`Missing cross-genre Type at ${p.index}`);
      return target;
    }
    const name = p.text.trim().replace(/ \(tier[- ]restricted\)$/, "");
    // Source typos stay visible; only their explicit native destinations use
    // the complete spelling of the corresponding canonical Skill.
    const aliases = { 539: "Heavy equipment operation", 2562: "Pickpocketing" };
    const matches = definitions.filter(row => row.document.name.toLowerCase() === (aliases[p.index] ?? name).toLowerCase()
      && (listContext === "skills" ? row.pack === "skills-en" : listContext === "foci" ? row.pack === "foci-en"
        : listContext === "species" ? row.logicalId.startsWith("descriptor.species.") : listContext === "types" ? row.pack === "types-en" : false));
    const scoped = listContext === "types" ? matches.filter(row => p.section.includes(row.document.system.subgenre)) : matches;
    const candidates = scoped.length ? scoped : matches;
    if (candidates.length > 1) unresolved.push({ paragraph: p.index,
      reason: "Source list does not distinguish same-name Type variants; full label kept in Journal",
      candidates: candidates.map(row => row.logicalId) });
    return candidates.length === 1 ? candidates[0] : null;
  }

  for (const chapter of GENRE_CHAPTERS) {
    const source = paragraphs.filter(p => p.index >= chapter.start && p.index <= chapter.end && p.text.trim());
    if (source[0]?.text.trim() !== chapter.title) throw new Error(`CRD genre boundary changed at ${chapter.start}`);
    const document = journal(chapter.key, chapter.title, chapter.start, chapter.end);
    let current = page(document, `${chapter.key}-overview`, chapter.title, "");
    let emitted = new Set();
    type = null; activeAbility = null; listContext = null;
    function append(html) { current.text.content += (current.text.content ? "\n" : "") + html; }
    function assign(p, proof = null) {
      destinations.push({ paragraph: p.index, sourceSha256: digest(p.text),
        ...(proof ? { kind: "canonical-item", ...proof } : { kind: "journal", logicalId: document.flags.cypherFoundry.crd.logicalId, pageId: current._id }) });
    }
    for (const [ordinal, p] of source.entries()) {
      const text = p.text.trim();
      if (ordinal === 0) { assign(p); continue; }
      if (["Heading2", "H2"].includes(p.style)) {
        // The DOCX parser does not promote the custom H2 style into section
        // paths. Anchor its source position as well, so sibling H2 headings
        // cannot acquire the same native JournalEntryPage identity.
        current = page(document, `genre-${p.index}-${identitySlug(text)}`, text, "");
        emitted = new Set(); type = null; activeAbility = null; listContext = listFor(text);
        assign(p); continue;
      }
      if (p.style === "Heading3") { type = typeFor(p); activeAbility = null; }
      const speciesMatch = ["Heading3", "TypeHeaders"].includes(p.style) ? species.filter(row => row.document.name === text) : [];
      if (speciesMatch.length === 1) { type = speciesMatch[0]; activeAbility = null; }
      if (p.style === "TypeHeaders") activeAbility = null;
      const header = abilityHeader.exec(text);
      if (header) {
        const owned = (type?.document.system.abilities ?? []).map(uuid => byUUID.get(uuid)).filter(Boolean);
        const inGenreList = /Genre Abilities|Origin Superhero Abilities/.test(p.section);
        const candidates = (type ? owned : inGenreList ? abilities : []).filter(row => row.document.name === header[1]
          && auditAbilityBaseCost(row.document.system, [p]).status !== "base-cost-mismatch" && prove(row, p, header[0]));
        activeAbility = candidates.length === 1 ? candidates[0] : null;
        abilityLabel = header[0];
        if (candidates.length > 1) unresolved.push({ paragraph: p.index, reason: "Ambiguous canonical Ability occurrence; full source kept in Journal", candidates: candidates.map(row => row.logicalId) });
      }
      const target = activeAbility ?? type;
      const proof = target ? prove(target, p, header && activeAbility ? header[0] : "") : null;
      // Native table structure belongs to the reference, never to independent
      // character fields that happen to contain short labels or numbers.
      if (proof && !p.cell && p.style !== "Heading3" && p.style !== "TypeHeaders") {
        if (!emitted.has(target.logicalId)) {
          append(`<p>${link(target.logicalId, target.pack.replace(/-en$/, ""), activeAbility ? abilityLabel : target.document.name)}</p>`);
          emitted.add(target.logicalId);
        }
        assign(p, proof); continue;
      }
      if (listFor(text)) listContext = listFor(text);
      else if (/^Heading/.test(p.style)) listContext = null;
      if (p.cell) {
        const [table, row, column] = p.cell;
        const previous = source[ordinal - 1]?.cell, next = source[ordinal + 1]?.cell;
        if (!previous || previous[0] !== table) append("<table><tbody>");
        if (!previous || previous[0] !== table || previous[1] !== row) append("<tr>");
        // The table states the Type name and rank in adjacent cells. Together
        // they identify the canonical definition without adding a rank to the
        // visible name or interpreting the power-shift column as mechanics.
        const rank = source[ordinal + 1];
        const tableType = column === 0 && row > 0 ? types.find(entry =>
          entry.document.name === `${text} (Rank ${rank?.text.trim()})`
          && entry.document.system.subgenre === "Superheroes") : null;
        const content = tableType ? link(tableType.logicalId, "types", text) : escape(text);
        append(`<${row === 0 ? "th" : "td"}>${content}</${row === 0 ? "th" : "td"}>`);
        if (!next || next[0] !== table || next[1] !== row) append("</tr>");
        if (!next || next[0] !== table) append("</tbody></table>");
      } else {
        const direct = type && ["Heading3", "TypeHeaders"].includes(p.style) && type.document.name === text ? type : reference(p);
        if (direct) {
          const tag = ["Heading3", "TypeHeaders"].includes(p.style) ? "h3" : "p";
          append(`<${tag}>${link(direct.logicalId, direct.pack.replace(/-en$/, ""), text)}</${tag}>`);
          emitted.add(direct.logicalId);
        } else append(paragraphsHTML([p]));
      }
      assign(p);
    }
    // Do not invent empty placeholders: a source heading is itself the page title.
    for (const entry of document.pages) if (!entry.text.content) entry.text.content = `<p>${escape(entry.name)}</p>`;
    documents.push(document);
  }
  const expected = paragraphs.filter(p => p.index >= 457 && p.index <= 3437 && p.text.trim());
  if (new Set(destinations.map(row => row.paragraph)).size !== expected.length) throw new Error("Incomplete or duplicate genre source partition");
  const ranges = [];
  for (const destination of destinations) {
    const { paragraph, sourceSha256: _hash, ...target } = destination;
    const previous = ranges.at(-1);
    if (previous && JSON.stringify(previous.target) === JSON.stringify(target)) previous.end = paragraph;
    else ranges.push({ start: paragraph, end: paragraph, target });
  }
  const bounded = ranges.map(({ start, end, target }) => ({ start, end, ...target,
    sourceSha256: digest(paragraphs.filter(p => p.index >= start && p.index <= end && p.text.trim()).map(p => p.text).join("\n")) }));
  return { documents, coverage: { schemaVersion: 1, referenceSha256: REFERENCE_SHA256, sourceRange: [457, 3437],
    nonblankParagraphs: expected.length, journalIds: GENRE_JOURNAL_IDS, destinations: bounded, unresolved } };
}
