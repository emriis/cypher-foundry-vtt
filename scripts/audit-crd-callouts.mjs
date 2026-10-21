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

/** Keep focused player-facing editorial passages source-complete in EN. */
export function validateFocusCallouts(candidates, focusCount) {
  const focus = candidates.filter(item => item.section?.startsWith("Foci /") &&
    ["gm-intrusion", "genre-themes"].includes(item.kind));
  const errors = [];
  for (const kind of ["gm-intrusion", "genre-themes"]) {
    const entries = focus.filter(item => item.kind === kind);
    if (entries.length !== focusCount) {
      errors.push("Expected " + focusCount + " Focus " + kind + " source paragraphs, found " + entries.length + ".");
    }
    for (const item of entries) {
      if (item.coverage.status !== "verbatim-in-english-pack") {
        errors.push("Unrepresented Focus " + kind + " at CRD paragraph " + item.paragraph + ".");
      }
    }
  }
  return errors;
}

/** Source-locked editorial decisions cannot silently drift to another paragraph. */
export function validateAdjudications(candidates, decisionFile, referenceHash) {
  if (decisionFile.referenceSha256 !== referenceHash) {
    throw new Error("CRD decision inventory is tied to a different source revision.");
  }
  const indexed = new Map(candidates.map(item => [item.paragraph, item]));
  const seen = new Set();
  for (const decision of decisionFile.decisions) {
    if (seen.has(decision.paragraph)) throw new Error("Duplicate callout disposition: " + decision.paragraph);
    seen.add(decision.paragraph);
    const current = indexed.get(decision.paragraph);
    if (!current || current.kind !== decision.kind ||
        !current.section.startsWith(decision.sectionPrefix)) {
      throw new Error("Callout disposition no longer matches the CRD: " + decision.paragraph);
    }
    if (current.coverage.status === "verbatim-in-english-pack") {
      throw new Error("Already-covered callout should not be deferred: " + decision.paragraph);
    }
    if (decision.status !== "deferred-full-crd-journal" || !decision.reason.trim() || !decision.target.trim()) {
      throw new Error("Unsupported or incomplete callout decision: " + decision.paragraph);
    }
  }
  return new Map(decisionFile.decisions.map(item => [item.paragraph, item]));
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
    const texts = sourceFields(records);
    const sourceByField = new Map(texts.map(item => [item.file + ":" + item.field, item]));
    // A different .docx byte hash invalidates blanket use of historical
    // locators, but individual passages may be safely revalidated against
    // this exact file when their complete stored English field occurs in the
    // same CRD paragraph window. Never silently trust old positions.
    const revalidatedLocators = baselineHashMatches ? baseline.fields : baseline.fields.filter(contract => {
      const original = sourceByField.get(contract.file + ":" + contract.field);
      if (!original || !Number.isInteger(contract.source?.start) ||
          !Number.isInteger(contract.source?.end)) return false;
      const expected = plainText(original.text);
      const inWindow = paragraphs.filter(p => p.index >= contract.source.start &&
        p.index <= contract.source.end).map(p => plainText(p.text)).join(" ");
      return expected.length >= 24 && inWindow.includes(expected);
    });
    const candidates = inventory.candidates.map(raw => {
      const p = paragraphs[raw.paragraph];
      if (!p || p.index !== raw.paragraph) throw new Error("CRD source locator mismatch: " + raw.paragraph);
      return {
        ...raw,
        coverage: locateCallout({ ...raw, text: p.text }, texts, revalidatedLocators)
      };
    });
    const expectedFocusCount = records.filter(row => row.pack === "foci-en").length;
    const focusErrors = validateFocusCallouts(candidates, expectedFocusCount);
    if (focusErrors.length) throw new Error(focusErrors.join("\n"));
    const decisionFile = JSON.parse(await fs.readFile(
      path.join(root, "data/crd-callout-adjudications.json"), "utf8"));
    const decisions = validateAdjudications(candidates, decisionFile, actualHash);
    for (const entry of candidates) {
      if (decisions.has(entry.paragraph)) entry.adjudication = decisions.get(entry.paragraph);
    }
    const statusCounts = {};
    const kindCounts = {};
    for (const entry of candidates) {
      const status = entry.coverage.status;
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      kindCounts[entry.kind] ??= {};
      kindCounts[entry.kind][status] = (kindCounts[entry.kind][status] ?? 0) + 1;
    }
    // Reconstruct probable multi-paragraph visual boxes conservatively.
    // A box is only fully evidenced when each substantive paragraph can be
    // located, and this never implies editorial ownership by one Item.
    const visual = candidates.filter(item => item.kind === "visually-marked");
    const visualGroups = [];
    for (const item of visual) {
      const previous = visualGroups.at(-1);
      if (previous && previous.paragraphEnd + 1 === item.paragraph &&
          previous.section === item.section && previous.style === item.style) {
        previous.paragraphEnd = item.paragraph;
        previous.paragraphs++;
        previous.evidence.push(item.coverage.status);
      } else {
        visualGroups.push({ paragraphStart: item.paragraph, paragraphEnd: item.paragraph,
          section: item.section, style: item.style, paragraphs: 1,
          excerpt: item.excerpt, evidence: [item.coverage.status] });
      }
    }
    const boxes = visualGroups.map(({ evidence, ...group }) => ({
      ...group,
      status: evidence.every(status => status === "verbatim-in-english-pack")
        ? "all-paragraphs-match" : "review-required",
      matchedParagraphs: evidence.filter(status => status === "verbatim-in-english-pack").length
    }));
    // Tables are separately inventoried because a table of Items is not
    // automatically an editorial sidebar and may span many CRD paragraphs.
    const data = {
      schemaVersion: 1,
      crdVersion: "2026-07-29",
      referenceSha256: actualHash,
      scope: "CRD callout candidates and tables; no completeness claim for full CRD Journals.",
      inputs: { reference: DOCX, sourceMode: normalized ? "normalized" : "authored",
        englishDocuments: records.filter(row => row.pack.endsWith("-en")).length,
        baselineContracts: baseline.fields.length, revalidatedContracts: revalidatedLocators.length,
        verifiedFocusCallouts: expectedFocusCount * 2, explicitlyDeferred: decisions.size, baselineHashMatches,
        historicalReferenceSha256: baseline.referenceSha256 },
      summary: { paragraphs: inventory.paragraphs, candidates: candidates.length,
        tables: inventory.tables.length, visualBoxes: boxes.length,
        visualBoxesNeedingReview: boxes.filter(item => item.status !== "all-paragraphs-match").length,
        sourceVerifiedFocusEditorialParagraphs: expectedFocusCount * 2,
        explicitlyDeferred: decisions.size,
        kinds: inventory.candidateTypes,
        coverage: statusCounts, coverageByKind: kindCounts,
        visualSignals: inventory.visualSignals, paragraphStyles: inventory.paragraphStyles },
      tables: inventory.tables,
      boxes,
      candidates
    };
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(data, null, 2) + "\n");
    console.log(JSON.stringify({
      report: path.relative(root, output), baselineHashMatches,
      actualReferenceSha256: actualHash, historicalReferenceSha256: baseline.referenceSha256,
      englishDocuments: data.inputs.englishDocuments, summary: {
        paragraphs: data.summary.paragraphs, tables: data.summary.tables,
        visualBoxes: data.summary.visualBoxes,
        visualBoxesNeedingReview: data.summary.visualBoxesNeedingReview,
        revalidatedContracts: revalidatedLocators.length,
        candidates: data.summary.candidates, kinds: data.summary.kinds,
        coverage: data.summary.coverage, visualSignals: data.summary.visualSignals
      },
      priorityReview: candidates.filter(item =>
        item.kind !== "visually-marked" && item.coverage.status !== "verbatim-in-english-pack")
        .slice(0, 60).map(({ paragraph, section, kind, excerpt, coverage }) =>
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
