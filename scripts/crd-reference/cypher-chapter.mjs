/** Cypher consultation chapter: complete source clauses and tables, with native
 * definition links. Reading a generation table never rolls or grants an Item.
 */
import { createHash } from "node:crypto";
import { journal, page, link, paragraphsHTML, REFERENCE_SHA256 } from "./creation-chapters.mjs";
import { CYPHER_CHAPTER, CYPHER_JOURNAL_IDS } from "./cypher-metadata.mjs";
import { identitySlug } from "../source-migration/id-contract.mjs";
import { plainText } from "../crd-audit/text-fidelity.mjs";
import { translationFields } from "../localization/compendium-translations.mjs";

const digest = text => createHash("sha256").update(text, "utf8").digest("hex");
const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const key = p => `cyphers-${p.index}-${identitySlug(p.text)}`;

/** Pure authoring output from the pinned CRD and normalized English catalogue.
 * Only a whole paragraph proven inside its own canonical field may be omitted.
 * Tables keep all cells even when an Item also contains a structured roll table.
 */
export function buildCypherChapter(paragraphs, records) {
  const { start, end, title } = CYPHER_CHAPTER;
  if (paragraphs.find(p => p.index === start)?.text.trim() !== title
    || paragraphs.find(p => p.index === end + 1)?.text.trim() !== "Rules of the Game") {
    throw new Error("CRD Cypher chapter boundary changed");
  }
  const source = paragraphs.filter(p => p.index >= start && p.index <= end && (p.text.trim() || p.cell));
  const cyphers = records.filter(row => row.document.type === "cypher");
  const fields = new Map(cyphers.map(row => [row.logicalId,
    [...translationFields(row.document)].map(([field, text]) => ({ field, text: plainText(text) }))]));
  const document = journal("cyphers", title, start, end);
  const overview = page(document, "cyphers-overview", title, "");
  const headings = new Map(source.filter(p => /^(Heading[23]|H2)$/.test(p.style))
    .map(p => [p.index, page(document, key(p), p.text.trim(), "")]));
  const assignments = [], tables = [], definitions = [];
  let current = overview, owner = null;
  const append = html => { current.text.content += (current.text.content ? "\n" : "") + html; };
  function assign(p, target = null) {
    if (p.text.trim()) assignments.push({ paragraph: p.index, ...(target ? { kind: "canonical-item", ...target }
      : { kind: "journal", logicalId: CYPHER_JOURNAL_IDS[0], pageId: current._id }) });
  }
  function findCypher(text, index) {
    // The CRD explicitly names Teleporter variants in its power tables. Link to
    // the common Item without selecting/rolling a variant merely by reading it.
    const name = text.replace(/^Teleporter \((bounder|traveler|planetary|interstellar)\)$/i, "Teleporter");
    const group = index < 6532 ? "subtle" : index >= 7330 ? "powerBoost" : "manifest";
    const matches = cyphers.filter(row => row.document.name.toLowerCase() === name.toLowerCase()
      && (group === "powerBoost" ? row.document.system.cypherCategory === "powerBoost"
        : row.document.system.cypherType === group && row.document.system.cypherCategory !== "powerBoost"));
    if (matches.length !== 1) throw new Error(`Missing or ambiguous Cypher destination at ${index}: ${text}`);
    return matches[0];
  }
  function tableLabel(p) {
    const [table, row, column] = p.cell;
    if (!row || column !== 1 || !p.text.trim()) return escape(p.text.trim());
    if ([28, 30, 31, 32, 33, 34, 38].includes(table)) {
      if (p.index === 7358) return link(CYPHER_JOURNAL_IDS[0], "rules", p.text.trim(), headings.get(5992)._id);
      const cypher = findCypher(p.text.trim(), p.index);
      return link(cypher.logicalId, "equipment", p.text.trim());
    }
    if (table === 29) {
      const destination = ({ Low: 6568, Medium: 6680, Advanced: 6798, High: 6859, Ultra: 6875 })[p.text.trim()];
      if (!destination) throw new Error(`Unknown manifest power table at ${p.index}`);
      return link(CYPHER_JOURNAL_IDS[0], "rules", p.text.trim(), headings.get(destination)._id);
    }
    return escape(p.text.trim());
  }
  for (let i = 0; i < source.length; i++) {
    const p = source[i], text = p.text.trim();
    if (p.index === start) { assign(p); continue; }
    if (headings.has(p.index)) {
      current = headings.get(p.index); owner = null; assign(p); continue;
    }
    if (p.cell) {
      const tableIndex = p.cell[0], group = [];
      while (i < source.length && source[i].cell?.[0] === tableIndex) group.push(source[i++]);
      i--;
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
        for (const paragraphs of cells.values()) {
          const tag = row === 0 ? "th" : "td";
          append(`<${tag}>${paragraphs.map(tableLabel).join("<br>")}</${tag}>`);
          paragraphs.forEach(p => assign(p));
        }
        append("</tr>");
      }
      append("</tbody></table>");
      tables.push({ index: tableIndex, start: group[0].index, end: group.at(-1).index,
        cells: [...rows.values()].reduce((sum, cells) => sum + cells.size, 0),
        blankParagraphs: group.filter(p => !p.text.trim()).length,
        logicalId: CYPHER_JOURNAL_IDS[0], pageId: current._id });
      continue;
    }
    if (p.style === "TypeHeaders") {
      owner = p.index >= 6255 ? findCypher(text, p.index) : null;
      append(owner ? `<h3>${link(owner.logicalId, "equipment", text)}</h3>` : `<h3>${escape(text)}</h3>`);
      if (owner) definitions.push({ paragraph: p.index, logicalId: owner.logicalId, pageId: current._id });
      assign(p); continue;
    }
    const proof = owner && fields.get(owner.logicalId).find(field => field.text.includes(plainText(text)));
    if (proof) assign(p, { logicalId: owner.logicalId, field: proof.field });
    else { append(paragraphsHTML([p])); assign(p); }
  }
  for (const entry of document.pages) if (!entry.text.content) entry.text.content = `<p>${escape(entry.name)}</p>`;
  const expected = source.filter(p => p.text.trim());
  if (new Set(assignments.map(p => p.paragraph)).size !== expected.length) throw new Error("Incomplete Cypher paragraph partition");
  const ranges = [];
  for (const { paragraph, ...target } of assignments) {
    const previous = ranges.at(-1);
    if (previous && JSON.stringify(previous.target) === JSON.stringify(target)) previous.end = paragraph;
    else ranges.push({ start: paragraph, end: paragraph, target });
  }
  return { documents: [document], coverage: { schemaVersion: 1, referenceSha256: REFERENCE_SHA256,
    sourceRange: [start, end], nonblankParagraphs: expected.length, journalIds: CYPHER_JOURNAL_IDS,
    destinations: ranges.map(({ start, end, target }) => ({ start, end, ...target,
      sourceSha256: digest(expected.filter(p => p.index >= start && p.index <= end).map(p => p.text).join("\n")) })),
    tables, definitions } };
}
