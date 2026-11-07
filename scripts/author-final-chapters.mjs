/** Explicit final-chapter authoring. Checks are read-only; --write owns three
 * English Journals and their coverage register, never French approval status.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readChapterReference } from "./author-reference-chapters.mjs";
import { buildFinalChapters } from "./crd-reference/final-chapters.mjs";
const ROOT = path.resolve(import.meta.dirname, "..");

/** Validate all source destinations before any intentional writes. */
export async function authorFinalChapters(root = ROOT, { write = false } = {}) {
  const result = buildFinalChapters(await readChapterReference(root));
  const files = new Map(result.documents.map(doc => [`packs/rules-en/_source/${doc._id}.json`, doc]));
  files.set("data/crd-reference-final.json", result.coverage);
  for (const [file, document] of files) {
    const content = JSON.stringify(document, null, 2) + "\n";
    if (write) await fs.writeFile(path.join(root, file), content, "utf8");
    else if ((await fs.readFile(path.join(root, file), "utf8")).replaceAll("\r\n", "\n") !== content) throw new Error(`CRD final source drift: ${file}`);
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  authorFinalChapters(ROOT, { write: process.argv.includes("--write") }).then(result =>
    console.log(`${result.documents.length} final Journals; ${result.coverage.nonblankParagraphs} source paragraphs; ${result.coverage.tables.length} tables.`))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
