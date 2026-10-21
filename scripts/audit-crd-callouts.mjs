/**
 * PR4: read-only source-backed inventory of CRD sidebars, GM intrusion notes,
 * examples, visually boxed content and tables. Never claim absence from an
 * Item alone proves an omission: the CRD has more material than seven Journals.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readCompendiumCatalogue } from "./review-translations.mjs";
import { translationFields } from "./localization/compendium-translations.mjs";
import { plainText } from "./crd-audit/text-fidelity.mjs";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DOCX = "docs/Cypher-Reference-Document-2026-07-29.docx";
const DEFAULT_OUTPUT = "reports/crd-callout-coverage.json";

/** Avoid treating short names or common fragments as evidence for whole boxes. */
export function locateCallout(candidate, authoredFields, sourceContracts = []) {
  const exact = authoredFields.filter(item => {
    const content = plainText(item.text);
    const target = plainText(candidate.text);
    return target.length >= 24 && content.includes(target);
  }).slice(0, 8).map(({ file, field, logicalId }) => ({ file, field, logicalId }));
  const bounded = sourceContracts.filter(item => {
    const locator = item.source ?? {};
    return Number.isInteger(locator.start) && Number.isInteger(locator.end) &&
      candidate.paragraph >= locator.start && candidate.paragraph <= locator.end;
  }).map(item => ({ file: item.file, field: item.field, scope: item.scope }));
  const exclusions = bounded.filter(item => item.scope === "editorial-excluded-from-normalized-packs");
  return {
    status: exact.length ? "verbatim-in-english-pack" :
      exclusions.length ? "editorial-exclusion-needs-destination" :
        bounded.length ? "locator-only-review-required" : "no-proven-pack-coverage",
    matches: exact,
    locatorClaims: bounded.slice(0, 12),
    note: "A paragraph match does not establish that its whole boxed passage is complete."
  };
}

function sourceFields(records) {
  return records.filter(record => record.pack.endsWith("-en"))
    .flatMap(record => [...translationFields(record.document)]
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([field, text]) => ({
        file: record.file, logicalId: record.logicalId, field, text
      })));
}

export async function auditCallouts({ root = ROOT, reference = path.join(ROOT, DOCX),
  output = path.join(ROOT, DEFAULT_OUTPUT), normalized = false } = {}) {
  let owned;
  try {
    if (normalized) {
      owned = await createValidationWorkspace(root);
      execFileSync(process.execPath, ["scripts/migrate-ability-sources.mjs"],
        { cwd: owned.root, windowsHide: true, stdio: "pipe", maxBuffer: 8 * 1024 * 1024 });
    }
    const scan = owned?.root ?? root;
    const python = process.env.CRD_AUDIT_PYTHON || (process.platform === "win32" ? "python" : "python3");
    const extractor = path.join(root, "scripts/crd-audit/read-callouts.py");
    const source = path.join(root, "scripts/crd-audit/read-docx.py");
    const options = { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 };
    const inventory = JSON.parse(execFileSync(python, [extractor, reference], options));
    const paragraphs = JSON.parse(execFileSync(python, [source, reference], options)).paragraphs;
    const records = await readCompendiumCatalogue(scan);
    const baseline = JSON.parse(await fs.readFile(path.join(root, "data/crd-text-fidelity.json"), "utf8"));
    const actualHash = createHash("sha256").update(await fs.readFile(reference)).digest("hex");
    if (actualHash !== inventory.referenceSha256) throw new Error("CRD extractor SHA mismatch.");
    // The committed CRD can differ byte-for-byte from the historical private
    // reference used by the original evidence catalogue. In that case do not
    // apply stale positional locators: direct source-text matches remain valid,
    // and the report requires fresh paragraph-by-paragraph adjudication.
    const baselineHashMatches = actualHash === baseline.referenceSha256;
    const trustworthyLocators = baselineHashMatches ? baseline.fields : [];
    const texts = sourceFields(records);
    const candidates = inventory.candidates.map(raw => {
      const p = paragraphs[raw.paragraph];
      if (!p || p.index !== raw.paragraph) throw new Error("CRD source locator mismatch: " + raw.paragraph);
      return {
        ...raw,
        coverage: locateCallout({ ...raw, text: p.text }, texts, trustworthyLocators)
      };
    });
    const statusCounts = {};
    const kindCounts = {};
    for (const entry of candidates) {
      const status = entry.coverage.status;
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      kindCounts[entry.kind] ??= {};
      kindCounts[entry.kind][status] = (kindCounts[entry.kind][status] ?? 0) + 1;
    }
    // Tables are separately inventoried because a table of Items is not
    // automatically an editorial sidebar and may span many CRD paragraphs.
    const data = {
      schemaVersion: 1,
      crdVersion: "2026-07-29",
      referenceSha256: actualHash,
      scope: "CRD callout candidates and tables; no completeness claim for full CRD Journals.",
      inputs: { reference: DOCX, sourceMode: normalized ? "normalized" : "authored",
        englishDocuments: records.filter(row => row.pack.endsWith("-en")).length,
        baselineContracts: baseline.fields.length, baselineHashMatches,
        historicalReferenceSha256: baseline.referenceSha256 },
      summary: { paragraphs: inventory.paragraphs, candidates: candidates.length,
        tables: inventory.tables.length, kinds: inventory.candidateTypes,
        coverage: statusCounts, coverageByKind: kindCounts,
        visualSignals: inventory.visualSignals, paragraphStyles: inventory.paragraphStyles },
      tables: inventory.tables,
      candidates
    };
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(data, null, 2) + "\n");
    console.log(JSON.stringify({
      report: path.relative(root, output), baselineHashMatches,
      actualReferenceSha256: actualHash, historicalReferenceSha256: baseline.referenceSha256,
      englishDocuments: data.inputs.englishDocuments, summary: {
        paragraphs: data.summary.paragraphs, tables: data.summary.tables,
        candidates: data.summary.candidates, kinds: data.summary.kinds,
        coverage: data.summary.coverage, visualSignals: data.summary.visualSignals
      },
      unresolvedSamples: candidates.filter(item => item.coverage.status !== "verbatim-in-english-pack")
        .slice(0, 15).map(({ paragraph, section, kind, excerpt, coverage }) =>
          ({ paragraph, kind, section, excerpt, status: coverage.status }))
    }, null, 2));
    return data;
  } finally {
    if (owned) await removeValidationWorkspace(owned.workspace);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const argument = (key, otherwise) =>
    args.includes(key) ? args[args.indexOf(key) + 1] : otherwise;
  await auditCallouts({
    root: ROOT,
    reference: path.resolve(argument("--crd", path.join(ROOT, DOCX))),
    output: path.resolve(argument("--output", path.join(ROOT, DEFAULT_OUTPUT))),
    normalized: args.includes("--normalized")
  });
}
