/** Explicit authoring command: reread the supplied CRD, validate all destinations,
 * then write only this tranche's English Journals and coverage register.
 * Default --check is read-only; French proposals are never generated/approved here.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readCompendiumCatalogue } from "./review-translations.mjs";
import { buildCreationChapters, REFERENCE_SHA256 } from "./crd-reference/creation-chapters.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Read the exact checked-in reference; runtime and ordinary builds use JSON only. */
export async function readChapterReference(root = ROOT) {
  const reference = path.join(root, "docs/Cypher-Reference-Document-2026-07-29.docx");
  const bytes = await fs.readFile(reference);
  if (createHash("sha256").update(bytes).digest("hex") !== REFERENCE_SHA256) throw new Error("CRD source revision changed; review chapter boundaries first");
  return JSON.parse(execFileSync(process.platform === "win32" ? "python" : "python3",
    [path.join(root, "scripts/crd-audit/read-docx.py"), reference], { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 })).paragraphs;
}

/** Validate the complete batch before writing; never mutate unrelated source files. */
export async function authorReferenceChapters(root = ROOT, { write = false } = {}) {
  const [paragraphs, records] = await Promise.all([readChapterReference(root), readCompendiumCatalogue(root, { languages: ["en"] })]);
  const result = buildCreationChapters(paragraphs, records);
  const files = new Map(result.documents.map(doc => [`packs/rules-en/_source/${doc._id}.json`, doc]));
  files.set("data/crd-reference-creation.json", result.coverage);
  for (const [relative, document] of files) {
    const content = JSON.stringify(document, null, 2) + "\n";
    if (write) await fs.writeFile(path.join(root, relative), content, "utf8");
    else if ((await fs.readFile(path.join(root, relative), "utf8")).replaceAll("\r\n", "\n") !== content) throw new Error(`CRD chapter source drift: ${relative}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  authorReferenceChapters(ROOT, { write: process.argv.includes("--write") }).then(result =>
    console.log(`${result.documents.length} chapter/index Journals; ${result.coverage.nonblankParagraphs} source paragraphs assigned.`))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
