/** Reconcile source partitions, rather than equating substring audit scores
 * with chapter completeness. Historical visual IDs remain traceable to source.
 */
import { createHash } from "node:crypto";
import { REFERENCE_SHA256 } from "./creation-chapters.mjs";
export const PARTITION_FILES = ["creation", "genres", "details", "cyphers", "final"]
  .map(name => `data/crd-reference-${name}.json`);
const digest = value => createHash("sha256").update(value, "utf8").digest("hex");

/** All nonblank paragraphs must have exactly one destination across tranches.
 * Blank cells still count as table structure; no missing artwork is invented.
 */
export function buildReferenceCompleteness(paragraphs, partitions, baseline) {
  const targets = new Map();
  for (const partition of partitions) {
    if (partition.referenceSha256 !== REFERENCE_SHA256) throw new Error("Reference partition hash mismatch");
    for (const target of partition.destinations) {
      const source = paragraphs.filter(p => p.index >= target.start && p.index <= target.end && p.text.trim());
      if (digest(source.map(p => p.text).join("\n")) !== target.sourceSha256) throw new Error(`Partition source drift at ${target.start}`);
      for (const p of source) {
        if (targets.has(p.index)) throw new Error(`Duplicate source destination at ${p.index}`);
        const { sourceSha256: _hash, start: _start, end: _end, ...destination } = target;
        targets.set(p.index, destination);
      }
    }
  }
  const source = paragraphs.filter(p => p.text.trim());
  for (const p of source) if (!targets.has(p.index)) throw new Error(`Missing source destination at ${p.index}`);
  const tables = [];
  for (const index of new Set(paragraphs.filter(p => p.cell).map(p => p.cell[0]))) {
    const cells = paragraphs.filter(p => p.cell?.[0] === index);
    tables.push({ index, start: cells[0].index, end: cells.at(-1).index,
      cells: new Set(cells.map(p => p.cell.slice(1).join(":"))).size,
      blankParagraphs: cells.filter(p => !p.text.trim()).length,
      sourceSha256: digest(cells.map(p => p.text).join("\n")),
      destinations: [...new Map(cells.filter(p => p.text.trim()).map(p => {
        const target = targets.get(p.index); return [JSON.stringify(target), target];
      })).values()] });
  }
  // Only the original five-column review rows carry a matched/total column.
  // Later disposition tables must not duplicate these historical group IDs.
  const visualGroups = [...baseline.matchAll(/^\| (B\d+) \| (\d+)[–-](\d+) \| \d+\/\d+ \|/gm)].map(([, id, start, end]) => {
    const group = source.filter(p => p.index >= Number(start) && p.index <= Number(end));
    return { id, start: Number(start), end: Number(end), paragraphs: group.length,
      sourceSha256: digest(group.map(p => p.text).join("\n")),
      destinations: [...new Map(group.map(p => { const target = targets.get(p.index); return [JSON.stringify(target), target]; })).values()] };
  });
  if (tables.length !== 61 || visualGroups.length !== 100 || new Set(visualGroups.map(g => g.id)).size !== 100) {
    throw new Error("Source table or historical visual-group inventory drift");
  }
  return { schemaVersion: 1, referenceSha256: REFERENCE_SHA256,
    scope: "Full CRD text, all source tables and the 100 historical open visual groups; not an automation or accessibility certification",
    paragraphs: paragraphs.length, nonblankParagraphs: source.length,
    sourceTextSha256: digest(source.map(p => p.text).join("\n")), partitionFiles: PARTITION_FILES,
    missingParagraphs: [], duplicateParagraphs: [], tables, visualGroups };
}
