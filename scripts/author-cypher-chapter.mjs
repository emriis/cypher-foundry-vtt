/** Explicit source authoring for the Cypher reference chapter. Default checks
 * are read-only; --write owns its English Journal and paragraph register only.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readChapterReference } from "./author-reference-chapters.mjs";
import { readReferenceCatalogue } from "./crd-reference/catalogue.mjs";
import { buildCypherChapter } from "./crd-reference/cypher-chapter.mjs";
const ROOT = path.resolve(import.meta.dirname, "..");

/** Validate the full chapter before writing; never modifies French proposals. */
export async function authorCypherChapter(root = ROOT, { write = false } = {}) {
  const [paragraphs, records] = await Promise.all([readChapterReference(root), readReferenceCatalogue(root)]);
  const result = buildCypherChapter(paragraphs, records);
  const files = new Map(result.documents.map(doc => [`packs/rules-en/_source/${doc._id}.json`, doc]));
  files.set("data/crd-reference-cyphers.json", result.coverage);
  for (const [file, document] of files) {
    const content = JSON.stringify(document, null, 2) + "\n";
    if (write) await fs.writeFile(path.join(root, file), content, "utf8");
    else if ((await fs.readFile(path.join(root, file), "utf8")).replaceAll("\r\n", "\n") !== content) throw new Error(`CRD Cypher source drift: ${file}`);
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  authorCypherChapter(ROOT, { write: process.argv.includes("--write") }).then(result =>
    console.log(`${result.documents[0].pages.length} Cypher pages; ${result.coverage.nonblankParagraphs} source paragraphs; ${result.coverage.tables.length} tables.`))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
