/** Explicit genre authoring; French text and existing source records are never
 * inferred or rewritten. --check/default is read-only; --write owns five files.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readChapterReference } from "./author-reference-chapters.mjs";
import { readReferenceCatalogue } from "./crd-reference/catalogue.mjs";
import { buildGenreChapters } from "./crd-reference/genre-chapters.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Validate all source text/targets before writing any genre document. */
export async function authorGenreChapters(root = ROOT, { write = false } = {}) {
  const [paragraphs, records] = await Promise.all([readChapterReference(root), readReferenceCatalogue(root)]);
  const result = buildGenreChapters(paragraphs, records);
  const files = new Map(result.documents.map(doc => [`packs/rules-en/_source/${doc._id}.json`, doc]));
  files.set("data/crd-reference-genres.json", result.coverage);
  for (const [relative, document] of files) {
    const content = JSON.stringify(document, null, 2) + "\n";
    if (write) await fs.writeFile(path.join(root, relative), content, "utf8");
    else if ((await fs.readFile(path.join(root, relative), "utf8")).replaceAll("\r\n", "\n") !== content) throw new Error(`CRD genre source drift: ${relative}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  authorGenreChapters(ROOT, { write: process.argv.includes("--write") }).then(result =>
    console.log(`${result.documents.length} genre Journals; ${result.coverage.nonblankParagraphs} source paragraphs assigned.`))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
