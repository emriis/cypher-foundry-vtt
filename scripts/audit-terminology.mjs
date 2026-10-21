/**
 * PR5 shared terminology audit across native Foundry UI strings and the single
 * French compendium editorial authority. Read-only, source-preserving.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readLocaleSources } from "./build-locales.mjs";
import { readFrenchProposals } from "./review-translations.mjs";
import { validateGlossary, reviewFrenchStyle, inclusiveStyleHints,
  mechanicalTerminologyHints } from "./localization/terminology.mjs";
import { flattenLocale } from "./localization/locales.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

export async function auditTerminology(root = ROOT, output = path.join(root, "reports/terminology-fr.json")) {
  const [glossarySource, en, fr, proposals] = await Promise.all([
    fs.readFile(path.join(root, "data/localization/glossary-fr.json"), "utf8"),
    readLocaleSources(root, "en"), readLocaleSources(root, "fr"),
    readFrenchProposals(root)
  ]);
  const glossary = JSON.parse(glossarySource);
  const errors = validateGlossary(glossary, en.dictionary, fr.dictionary);
  const current = flattenLocale(fr.dictionary);
  const uiFlags = [];
  for (const [key, value] of Object.entries(current)) {
    const inclusive = inclusiveStyleHints(value);
    const mechanics = mechanicalTerminologyHints(value);
    if (inclusive.length || mechanics.length) {
      uiFlags.push({ key, inclusive, mechanics, requiresHumanReview: true });
    }
  }
  const proposalsAudit = reviewFrenchStyle(proposals);
  const termsByStatus = Object.fromEntries(["confirmed", "established", "proposed"].map(status => [
    status, glossary.entries.filter(entry => entry.status === status).length
  ]));
  const report = {
    schemaVersion: 1,
    source: "Cypher Reference Document 2026-07-29 EN; language terms from repo-reviewed decisions and UI usage",
    scope: "FR UI terminology bindings and advisory inclusive-mechanical review of proposal prose",
    normativeGuarantee: "Only named UI bindings are mechanically enforced; narrative flags require CRD-grounded human editorial decisions.",
    summary: {
      terms: glossary.entries.length, statuses: termsByStatus,
      uiKeys: Object.keys(current).length,
      checkedUiBindings: glossary.entries.reduce((n, entry) => n + entry.uiBindings.length, 0),
      frenchProposals: proposalsAudit.summary.proposals,
      frenchProposalFields: proposalsAudit.summary.fields,
      proposalStatuses: proposalsAudit.summary.statuses,
      uiHints: uiFlags.length,
      ...{ proposalStyleFlags: proposalsAudit.summary.styleFlags,
        proposalMechanicsFlags: proposalsAudit.summary.mechanicsFlags },
      blockingErrors: errors.length
    },
    errors,
    uiFlags,
    proposalReview: proposalsAudit
  };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output: path.relative(root, output), summary: report.summary,
    errors: errors.slice(0, 20) }, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const index = process.argv.indexOf("--output");
    if (index >= 0 && !process.argv[index + 1]) throw new Error("--output requires a path.");
    const out = index >= 0 ? path.resolve(process.argv[index + 1]) : undefined;
    const report = await auditTerminology(ROOT, out);
    if (report.errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  }
}
