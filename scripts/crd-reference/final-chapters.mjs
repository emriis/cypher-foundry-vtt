/** Complete general rules, advancement and source-publisher attribution.
 * Quick references remain separate selections; no source rule is summarized.
 */
import { createHash } from "node:crypto";
import { journal, page, link, paragraphsHTML, REFERENCE_SHA256 } from "./creation-chapters.mjs";
import { FINAL_CHAPTERS, FINAL_JOURNAL_IDS } from "./final-metadata.mjs";
import { identitySlug } from "../source-migration/id-contract.mjs";
const digest = text => createHash("sha256").update(text, "utf8").digest("hex");
const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Pure authoring result: every substantive paragraph and table cell survives.
 * Paragraph 0 is front matter, not a fifteenth substantive rules chapter.
 */
export function buildFinalChapters(paragraphs) {
  const documents = [], assignments = [], tables = [], destinations = new Map();
  if (paragraphs.length !== 8202 || paragraphs[0]?.text.trim() !== "Cypher Reference Document") {
    throw new Error("CRD final extent or front matter changed");
  }
  for (const chapter of FINAL_CHAPTERS) {
    if (paragraphs.find(p => p.index === chapter.start)?.text.trim() !== chapter.title) {
      throw new Error(`CRD final chapter boundary changed at ${chapter.start}`);
    }
    const source = paragraphs.filter(p => p.index >= chapter.start && p.index <= chapter.end && (p.text.trim() || p.cell));
    const document = journal(chapter.key, chapter.title, chapter.start, chapter.end);
    let current = page(document, `${chapter.key}-overview`, chapter.title, "");
    const assign = p => {
      if (p.text.trim()) assignments.push({ paragraph: p.index,
        logicalId: document.flags.cypherFoundry.crd.logicalId, pageId: current._id });
    };
    const append = html => { current.text.content += (current.text.content ? "\n" : "") + html; };
    for (let i = 0; i < source.length; i++) {
      const p = source[i];
      if (p.index === chapter.start) { assign(p); destinations.set(p.index, { document, page: current }); continue; }
      const split = /^(Heading2|H2)$/.test(p.style)
        || (chapter.key === "advancing-your-character" && p.style === "Heading3");
      if (split) {
        current = page(document, `final-${p.index}-${identitySlug(p.text)}`, p.text.trim(), "");
        assign(p); destinations.set(p.index, { document, page: current }); continue;
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
            // Table 46 is eight genre statements, with no header row.
            const tag = row === 0 && tableIndex !== 46 ? "th" : "td";
            append(`<${tag}>${paragraphs.map(p => escape(p.text.trim())).join("<br>")}</${tag}>`);
            paragraphs.forEach(assign);
          }
          append("</tr>");
        }
        append("</tbody></table>");
        tables.push({ index: tableIndex, start: group[0].index, end: group.at(-1).index,
          cells: [...rows.values()].reduce((sum, cells) => sum + cells.size, 0),
          blankParagraphs: group.filter(p => !p.text.trim()).length,
          logicalId: document.flags.cypherFoundry.crd.logicalId, pageId: current._id });
        continue;
      }
      append(p.style === "Heading4" ? `<h4>${escape(p.text.trim())}</h4>`
        : p.style === "TypeHeaders" ? `<h3>${escape(p.text.trim())}</h3>` : paragraphsHTML([p]));
      assign(p);
    }
    if (chapter.key === "credits") {
      // Attribute the publisher's statement to its actual author, so the CRD's
      // production claims cannot be read as claims about this unofficial system.
      current.text.content = '<aside class="crd-editorial"><p>The following credits and publisher statement are reproduced from the supplied CRD. They describe its publisher, not this unofficial Foundry conversion.</p></aside>\n'
        + current.text.content;
      current = page(document, "reference-source-title", "Source title", paragraphsHTML([paragraphs[0]]));
      assign(paragraphs[0]);
      // A URL used as the label is enriched again by Foundry, leaving an empty
      // sibling anchor. A descriptive label keeps one usable external link.
      page(document, "reference-license-notice", "License notice",
        '<p>Compatible with Cypher</p><p>This product is an independent production and is not affiliated with Monte Cook Games, LLC. It is published under the Cypher Open License, found at <a href="https://col.montecookgames.com">Cypher Open License website</a>.</p>'
        + '<p>CYPHER and its logo are trademarks of Monte Cook Games, LLC in the U.S.A. and other countries. All Monte Cook Games characters and character names, and the distinctive likenesses thereof, are trademarks of Monte Cook Games, LLC.</p>');
      document.flags.cypherFoundry.crd.sourceLocator += "; front-matter title at paragraph 0";
    }
    for (const entry of document.pages) if (!entry.text.content) entry.text.content = `<p>${escape(entry.name)}</p>`;
    documents.push(document);
  }
  // This is editorial navigation only. Source clauses above are kept verbatim.
  for (const [from, targets] of [[7395, [7990, 8083]], [7561, [7531, 7610]],
    [7903, [7704, 7760]], [7956, [7965, 7467]], [8085, [8172, 8117]], [8117, [7963, 7976]]]) {
    const owner = destinations.get(from);
    owner.page.text.content += '\n<nav class="crd-related"><p>Related rules</p><ul>' + targets.map(index => {
      const target = destinations.get(index);
      if (!target) throw new Error(`Missing final navigation destination ${index}`);
      return `<li>${link(target.document.flags.cypherFoundry.crd.logicalId, "rules", target.page.name, target.page._id)}</li>`;
    }).join("") + "</ul></nav>";
  }
  assignments.sort((a, b) => a.paragraph - b.paragraph);
  const expected = paragraphs.filter(p => (p.index === 0 || p.index >= 7381) && p.text.trim());
  if (new Set(assignments.map(p => p.paragraph)).size !== expected.length) throw new Error("Incomplete final paragraph partition");
  const ranges = [];
  for (const { paragraph, ...target } of assignments) {
    const previous = ranges.at(-1);
    if (previous && JSON.stringify(previous.target) === JSON.stringify(target)) previous.end = paragraph;
    else ranges.push({ start: paragraph, end: paragraph, target });
  }
  return { documents, coverage: { schemaVersion: 1, referenceSha256: REFERENCE_SHA256,
    sourceRange: [7381, 8201], additionalParagraphs: [0], nonblankParagraphs: expected.length,
    journalIds: FINAL_JOURNAL_IDS, destinations: ranges.map(({ start, end, target }) => ({ start, end, kind: "journal", ...target,
      sourceSha256: digest(expected.filter(p => p.index >= start && p.index <= end).map(p => p.text).join("\n")) })), tables } };
}
