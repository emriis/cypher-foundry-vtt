/**
 * PR10 editorial worksheet for the last batch of 176 Abilities.
 * This is an inspection tool, NEVER an automatic translator or approval process.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";
import { readCompendiumCatalogue, readFrenchProposals, reviewCatalogue } from "./review-translations.mjs";
import { inspectAbilityPair8 } from "./audit-ability-batch-2.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MANIFESTS = [1, 2, 3, 4].map(n => "data/localization/ability-review-batch-" + n + ".json");
const filenameCompare = (a, b) => a + ".json" < b + ".json" ? -1 : a + ".json" > b + ".json" ? 1 : 0;

/** Select the exact last tranche after the two previously locked manifests. */
export async function selectPR10Abilities(root = ROOT, proposals = null) {
  const manifests = await Promise.all(MANIFESTS.map(async file => JSON.parse(await fs.readFile(path.join(root, file), "utf8"))));
  const previous = new Set(manifests.slice(0, 3).flatMap(m => m.ids));
  if (manifests.some(m => m.expected !== (m.batch === "pr10-abilities-4-of-4" ? 176 : 175) || m.ids.length !== (m.batch === "pr10-abilities-4-of-4" ? 176 : 175) || new Set(m.ids).size !== (m.batch === "pr10-abilities-4-of-4" ? 176 : 175)) || previous.size !== 525) {
    throw new Error("PR7/PR8 manifests are not the expected disjoint 525 identities");
  }
  const authored = proposals ?? await readFrenchProposals(root);
  const all = [...authored.keys()].filter(id => id.startsWith("ability.")).sort(filenameCompare);
  if (all.length !== 701) throw new Error("Expected 701 canonical Ability records, got " + all.length);
  if (all.slice(0, 525).some(id => !previous.has(id))) throw new Error("First two batches no longer match canonical sort order");
  const ids = all.slice(525, 701);
  if (ids.length !== 176 || ids.some(id => previous.has(id))) throw new Error("PR10 selection overlaps prior reviews");
  if (JSON.stringify(ids) !== JSON.stringify(manifests[3].ids)) throw new Error("PR10 locked manifest drifted from canonical order");
  return manifests[3].ids;
}

export async function auditAbilityBatch10(root = ROOT, output = path.join(root, "reports/ability-review-batch-4.json")) {
  const proposals = await readFrenchProposals(root);
  const ids = await selectPR10Abilities(root, proposals);
  const workspace = await createValidationWorkspace(root);
  try {
    execFileSync(process.execPath, ["scripts/migrate-ability-sources.mjs"],
      { cwd: workspace.root, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const records = await readCompendiumCatalogue(workspace.root);
    const review = reviewCatalogue(records, proposals);
    const byId = new Map(records.filter(row => row.pack === "abilities-en").map(row => [row.logicalId, row]));
    const checks = new Map(review.entries.map(row => [row.logicalId, row]));
    const details = ids.map(id => {
      const source = byId.get(id), draft = proposals.get(id)?.proposal, check = checks.get(id);
      if (!source || !draft || !check || check.errors.length || check.missingFields.length ||
          !check.mechanicalParity || check.sourceFields !== check.translatedFields) {
        throw new Error("Invalid, stale or missing EN/FR pair: " + id + "; " + JSON.stringify(check));
      }
      return { ...inspectAbilityPair8(id, source.document, draft),
        status: draft.status, provenance: source.document.flags?.cypherFoundry?.crd,
        sourceFile: source.file, proposalFile: proposals.get(id).file };
    });
    const report = {
      version: 1, batch: "pr10-abilities-4-of-4", reference: "Cypher Reference Document 2026-07-29",
      reviewStatus: "editorial-comparison-required",
      warning: "An error-free source hash, paired field or automated audit is NOT semantic approval.",
      expected: 176, ids, statuses: details.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1; return acc;
      }, {}), flaggedEntries: details.filter(row => row.warningCount).length,
      warningCounts: details.reduce((sum, row) => sum + row.warningCount, 0), details
    };
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
    if (process.argv.includes("--print-pairs")) for (const row of details) {
      console.log("PR10_PAIR:" + JSON.stringify({
        id: row.logicalId, EN: row.nameEN, FR: row.nameFR,
        fields: row.fields.map(f => ({ path: f.path, english: f.english, french: f.french,
          cues: f.semanticReviewCues, terminology: f.mechanics }))
      }));
    }
    console.log(JSON.stringify({ batch: report.batch, count: ids.length, first: ids[0],
      last: ids.at(-1), statuses: report.statuses, flagged: report.flaggedEntries,
      warnings: report.warningCounts }, null, 2));
    return report;
  } finally {
    await removeValidationWorkspace(workspace.workspace);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  auditAbilityBatch10().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
