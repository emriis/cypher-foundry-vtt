/** Explicit, source-locked Foci/equipment authoring. Default checks are read-only;
 * --write owns two English Journals and their coverage register, never FR text.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readChapterReference } from "./author-reference-chapters.mjs";
import { readReferenceCatalogue } from "./crd-reference/catalogue.mjs";
import { buildDetailChapters } from "./crd-reference/detail-chapters.mjs";
const ROOT = path.resolve(import.meta.dirname, "..");

/** Validate the whole source partition before any intentional authoring writes. */
export async function authorDetailChapters(root = ROOT, { write = false } = {}) {
  const [paragraphs, records] = await Promise.all([readChapterReference(root), readReferenceCatalogue(root)]);
  const result = buildDetailChapters(paragraphs, records);
  const files = new Map(result.documents.map(doc => [`packs/rules-en/_source/${doc._id}.json`, doc]));
  files.set("data/crd-reference-details.json", result.coverage);
  for (const [file, document] of files) {
    const content = JSON.stringify(document, null, 2) + "\n";
    if (write) await fs.writeFile(path.join(root, file), content, "utf8");
    else if ((await fs.readFile(path.join(root, file), "utf8")).replaceAll("\r\n", "\n") !== content) throw new Error(`CRD detail source drift: ${file}`);
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  authorDetailChapters(ROOT, { write: process.argv.includes("--write") }).then(result =>
    console.log(`${result.documents.length} detail Journals; ${result.coverage.nonblankParagraphs} source paragraphs; ${result.coverage.tables.length} tables.`))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
