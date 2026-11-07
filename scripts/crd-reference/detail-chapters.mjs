/** Full Foci/equipment references. Canonical definitions are reached through
 * native links only after whole-paragraph evidence within the owning Focus.
 * Equipment tables keep all cells, including empty notes and numeric columns.
 */
import { createHash } from "node:crypto";
import { journal, page, link, paragraphsHTML, REFERENCE_SHA256 } from "./creation-chapters.mjs";
import { DETAIL_CHAPTERS, DETAIL_JOURNAL_IDS } from "./detail-metadata.mjs";
import { translationFields } from "../localization/compendium-translations.mjs";
import { plainText } from "../crd-audit/text-fidelity.mjs";
import { auditAbilityBaseCost } from "../crd-audit/source-fields.mjs";
import { identitySlug } from "../source-migration/id-contract.mjs";

const digest = value => createHash("sha256").update(value, "utf8").digest("hex");
const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const regexp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pure authoring output; records must have normalized English identities. */
export function buildDetailChapters(paragraphs, records) {
  const foci = records.filter(row => row.pack === "foci-en");
  const abilities = records.filter(row => row.pack === "abilities-en");
  const equipment = records.filter(row => row.logicalId.startsWith("equipment."));
  const byUUID = new Map(abilities.map(row => [`Compendium.cypher.abilities-en.Item.${row.document._id}`, row]));
  const fields = new Map([...foci, ...abilities].map(row => [row.logicalId,
    [...translationFields(row.document)].map(([field, value]) => ({ field, text: plainText(value) }))]));
  const names = [...new Set(abilities.map(row => row.document.name))].sort((a, b) => b.length - a.length);
  const header = new RegExp(`^(${names.map(regexp).join("|")})(?: \\([^:]*\\))?:`);
  const documents = [], assignments = [], unresolved = [], tables = [];
  const focusMatches = text => foci.filter(row => row.document.name.toLowerCase() === text.toLowerCase());
  function proof(row, paragraph, prefix = "") {
    const text = plainText(prefix ? paragraph.text.trim().slice(prefix.length) : paragraph.text);
    const match = text && fields.get(row.logicalId)?.find(field => field.text.includes(text));
    return match ? { logicalId: row.logicalId, field: match.field, ...(prefix ? { strippedPrefix: prefix } : {}) } : null;
  }

  for (const chapter of DETAIL_CHAPTERS) {
    const source = paragraphs.filter(p => p.index >= chapter.start && p.index <= chapter.end && (p.text.trim() || p.cell));
    if (source[0]?.text.trim() !== chapter.title) throw new Error(`CRD detail boundary changed at ${chapter.start}`);
    const document = journal(chapter.key, chapter.title, chapter.start, chapter.end);
    let current = page(document, `${chapter.key}-overview`, chapter.title, "");
    let focus = null, ability = null, list = false, equipmentGenre = null, price = null;
    let emitted = new Set();
    function append(html) { current.text.content += (current.text.content ? "\n" : "") + html; }
    function assign(p, target = null) {
      if (!p.text.trim()) return;
      assignments.push({ paragraph: p.index, ...(target ? { kind: "canonical-item", ...target }
        : { kind: "journal", logicalId: document.flags.cypherFoundry.crd.logicalId, pageId: current._id }) });
    }
    for (let ordinal = 0; ordinal < source.length; ordinal++) {
      const p = source[ordinal], text = p.text.trim();
      if (ordinal === 0) { assign(p); continue; }
      const focusHeading = p.style === "Heading3" ? focusMatches(text) : [];
      if (["Heading2", "H2"].includes(p.style) || focusHeading.length === 1) {
        current = page(document, `detail-${p.index}-${identitySlug(text)}`, text, "");
        emitted = new Set(); ability = null;
        if (focusHeading.length === 1) {
          focus = focusHeading[0]; list = false;
          append(`<p>${link(focus.logicalId, "foci", text)}</p>`);
          emitted.add(focus.logicalId);
        } else { focus = null; list = text === "Foci List"; }
        if (chapter.key === "equipment") {
          equipmentGenre = / Equipment$/.test(text) ? identitySlug(text.replace(/ Equipment$/, "")) : null;
          price = null;
        }
        assign(p); continue;
      }
      if (chapter.key === "equipment" && p.style === "Heading3") {
        const category = text.replace(/ Items$/, "");
        price = ({ Inexpensive: "inexpensive", "Moderately Priced": "moderate", Expensive: "expensive",
          "Very Expensive": "veryexpensive", Exorbitant: "exorbitant" })[category] ?? null;
      }
      if (p.cell) {
        // Assemble a whole Word table before rendering, including blank cells.
        // Multi-paragraph cells retain their original paragraph order.
        const tableIndex = p.cell[0], group = [];
        while (ordinal < source.length && source[ordinal].cell?.[0] === tableIndex) group.push(source[ordinal++]);
        ordinal--;
        const rows = new Map();
        for (const cell of group) {
          const [, row, column] = cell.cell;
          if (!rows.has(row)) rows.set(row, new Map());
          const cells = rows.get(row);
          cells.set(column, [...(cells.get(column) ?? []), cell]);
        }
        append("<table><tbody>");
        for (const [row, cells] of rows) {
          append("<tr>");
          for (const [column, paragraphs] of cells) {
            const tag = row === 0 ? "th" : "td";
            const content = paragraphs.map(cell => {
              let label = escape(cell.text.trim());
              if (row > 0 && column === 0 && equipmentGenre && price && cell.text.trim()) {
                const matches = equipment.filter(item => item.logicalId.startsWith(`equipment.${equipmentGenre}.${price}.`)
                  && plainText(item.document.name).toLowerCase() === plainText(cell.text).toLowerCase());
                if (matches.length !== 1) throw new Error(`Missing or ambiguous equipment table destination at ${cell.index}: ${cell.text}`);
                label = link(matches[0].logicalId, "equipment", cell.text.trim());
              }
              assign(cell);
              return label;
            }).join("<br>");
            append(`<${tag}>${content}</${tag}>`);
          }
          append("</tr>");
        }
        append("</tbody></table>");
        tables.push({ index: tableIndex, start: group[0].index, end: group.at(-1).index,
          cells: [...rows.values()].reduce((count, cells) => count + cells.size, 0),
          blankParagraphs: group.filter(cell => !cell.text.trim()).length,
          logicalId: document.flags.cypherFoundry.crd.logicalId, pageId: current._id });
        continue;
      }
      if (p.style === "TypeHeaders") ability = null;
      const match = focus && header.exec(text);
      if (match) {
        const candidates = focus.document.system.abilities.map(uuid => byUUID.get(uuid)).filter(Boolean)
          .filter(row => row.document.name === match[1] && auditAbilityBaseCost(row.document.system, [p]).status !== "base-cost-mismatch"
            && proof(row, p, match[0]));
        ability = candidates.length === 1 ? candidates[0] : null;
        if (candidates.length > 1) unresolved.push({ paragraph: p.index, candidates: candidates.map(row => row.logicalId),
          reason: "Ambiguous owned Ability occurrence; complete text retained in Journal" });
      }
      const target = ability ?? focus;
      const proven = target && p.style !== "TypeHeaders" ? proof(target, p, match && ability ? match[0] : "") : null;
      if (proven) {
        if (!emitted.has(target.logicalId)) {
          append(`<p>${link(target.logicalId, ability ? "abilities" : "foci", ability ? match[0] : target.document.name)}</p>`);
          emitted.add(target.logicalId);
        }
        assign(p, proven); continue;
      }
      const entry = list ? focusMatches(text) : [];
      append(entry.length === 1 ? `<p>${link(entry[0].logicalId, "foci", text)}</p>`
        : /^Tier [1-6]$/.test(text) ? `<h3>${escape(text)}</h3>` : paragraphsHTML([p]));
      assign(p);
    }
    for (const entry of document.pages) if (!entry.text.content) entry.text.content = `<p>${escape(entry.name)}</p>`;
    documents.push(document);
  }
  const expected = paragraphs.filter(p => p.index >= 3438 && p.index <= 5952 && p.text.trim());
  if (new Set(assignments.map(row => row.paragraph)).size !== expected.length) throw new Error("Incomplete detail paragraph partition");
  const ranges = [];
  for (const { paragraph, ...target } of assignments) {
    const previous = ranges.at(-1);
    if (previous && JSON.stringify(previous.target) === JSON.stringify(target)) previous.end = paragraph;
    else ranges.push({ start: paragraph, end: paragraph, target });
  }
  return { documents, coverage: { schemaVersion: 1, referenceSha256: REFERENCE_SHA256,
    sourceRange: [3438, 5952], nonblankParagraphs: expected.length, journalIds: DETAIL_JOURNAL_IDS,
    destinations: ranges.map(({ start, end, target }) => ({ start, end, ...target,
      sourceSha256: digest(paragraphs.filter(p => p.index >= start && p.index <= end && p.text.trim()).map(p => p.text).join("\n")) })),
    tables, unresolved } };
}
