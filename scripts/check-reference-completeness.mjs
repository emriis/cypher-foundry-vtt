/** Read-only full CRD reconciliation; --write explicitly authors its register. */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readChapterReference } from "./author-reference-chapters.mjs";
import { buildReferenceCompleteness, PARTITION_FILES } from "./crd-reference/completeness.mjs";
const ROOT = path.resolve(import.meta.dirname, "..");

/** Check source hashes and partition ownership before comparing stored output. */
export async function checkReferenceCompleteness(root = ROOT, { write = false } = {}) {
  const [paragraphs, partitions, baseline] = await Promise.all([readChapterReference(root),
    Promise.all(PARTITION_FILES.map(async file => JSON.parse(await fs.readFile(path.join(root, file), "utf8")))),
    fs.readFile(path.join(root, "docs/crd-reference-destinations.md"), "utf8")]);
  const result = buildReferenceCompleteness(paragraphs, partitions, baseline);
  const file = path.join(root, "data/crd-reference-completeness.json"), content = JSON.stringify(result, null, 2) + "\n";
  if (write) await fs.writeFile(file, content, "utf8");
  else if ((await fs.readFile(file, "utf8")).replaceAll("\r\n", "\n") !== content) throw new Error("CRD completeness register drift");
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkReferenceCompleteness(ROOT, { write: process.argv.includes("--write") }).then(result =>
    console.log(`${result.nonblankParagraphs} source paragraphs; ${result.tables.length} tables; ${result.visualGroups.length} historical visual groups; no missing or duplicate paragraph destinations.`))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
