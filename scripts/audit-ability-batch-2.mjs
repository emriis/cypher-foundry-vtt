/**
 * PR8: reproducible comparative worksheet for the second 175 canonical Abilities.
 * This tool does not approve translations: it exposes English source, draft FR
 * text, mechanically relevant cues, hashes, and uncertain clauses for review.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";
import { readCompendiumCatalogue, readFrenchProposals, reviewCatalogue } from "./review-translations.mjs";
import { translationFields } from "./localization/compendium-translations.mjs";
import { inclusiveStyleHints, mechanicalTerminologyHints } from "./localization/terminology.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export const PR8_MANIFEST = "data/localization/ability-review-batch-2.json";

const CUES = [
  ["exclusive", /\b(?:only|solely|exclusively|no other|cannot|can't)\b/giu,
    /\b(?:seulement|uniquement|exclusivement|ne\s+(?:peut|pouvez|pourra)|impossible|aucun(?:e)?)\b/giu],
  ["alternative", /\b(?:instead|rather than|or|alternatively)\b/giu,
    /\b(?:au lieu de|plutôt que|ou|sinon|autrement|à la place)\b/giu],
  ["conditional", /\b(?:if|unless|provided that|as long as|when|whenever)\b/giu,
    /\b(?:si|sauf|à condition|lorsque|quand|chaque fois)\b/giu],
  ["duration", /\b(?:until|for|after|before|round|turn|minute|hour|day)\b/giu,
    /\b(?:jusqu|pendant|après|avant|round|tour|minute|heure|jour)\b/giu],
  ["effort", /\b(?:Effort)\b/giu, /\b(?:Effort)\b/giu],
  ["recovery", /\b(?:recovery|recover(?:ies|y)?|rest)\b/giu,
    /\b(?:récupér|repos|rétabli|rétablir)\w*/giu],
  ["gm", /\b(?:GM|game master)\b/giu, /\b(?:MJ|meneuse|meneur)\b/giu],
  ["attack", /\battack\b|\battacks\b/giu, /\battaqu\w*/giu],
  ["action", /\b(?:Action|Enabler)\b/giu, /\b(?:Action|Aptitude passive|passive)\b/giu],
  ["range", /\b(?:immediate|short|long|very long) range\b/giu,
    /\b(?:portée|distance|immédiate|courte|longue)\b/giu]
];

const flatten = html => html.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
const count = (text, pattern) => [...text.matchAll(pattern)].length;

export function inspectAbilityPair8(id, english, proposal) {
  const sources = translationFields(english);
  const fields = [];
  let warnings = 0;
  for (const [field, source] of sources) {
    const fr = proposal.fields.find(entry => entry.path === field)?.text ?? "";
    const sourcePlain = flatten(source), frenchPlain = flatten(fr);
    const uncertain = [];
    for (const [cue, en, french] of CUES) {
      const sourceUses = count(sourcePlain, en);
      const translatedUses = count(frenchPlain, french);
      if (sourceUses && !translatedUses) uncertain.push({ cue, sourceOccurrences: sourceUses });
    }
    // These are *review flags*, not automatic claims of missing rules.
    const relativeLength = sourcePlain.length ? Number((frenchPlain.length / sourcePlain.length).toFixed(2)) : 0;
    if (sourcePlain.length >= 60 && (relativeLength < 0.55 || relativeLength > 2.3)) {
      uncertain.push({ cue: "length-ratio", ratio: relativeLength });
    }
    const inclusive = inclusiveStyleHints(fr), mechanics = mechanicalTerminologyHints(fr);
    warnings += uncertain.length + mechanics.length;
    fields.push({
      path: field,
      english: source, french: fr,
      sourceHash: proposal.fields.find(entry => entry.path === field)?.sourceHash,
      englishChars: sourcePlain.length, frenchChars: frenchPlain.length,
      ratio: relativeLength, semanticReviewCues: uncertain,
      inclusive, mechanics
    });
  }
  return {
    logicalId: id, nameEN: english.name,
    nameFR: proposal.fields.find(item => item.path === "name")?.text,
    tier: english.system?.tier,
    action: english.system?.action,
    enabler: english.system?.enabler,
    repeatable: english.system?.repeatable,
    prerequisites: english.system?.prerequisites ?? null,
    cost: english.system?.cost ?? null,
    fields,
    warningCount: warnings,
    authoringReview: "Complete English/French clause comparison is required; structural tests alone do not certify semantics."
  };
}

export async function auditAbilityBatch8(root = ROOT, output = path.join(root, "reports/ability-review-batch-2.json")) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, PR8_MANIFEST), "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.expected !== 175 || manifest.ids.length !== 175 ||
    new Set(manifest.ids).size !== 175 || manifest.ids.some(id => !/^ability\.[a-z0-9-]+$/.test(id))) {
    throw new Error("PR8 manifest must list 175 distinct canonical Ability identities.");
  }
  const workspace = await createValidationWorkspace(root);
  try {
    execFileSync(process.execPath, ["scripts/migrate-ability-sources.mjs"],
      { cwd: workspace.root, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    const [records, proposals] = await Promise.all([
      readCompendiumCatalogue(workspace.root), readFrenchProposals(root)
    ]);
    const catalogue = reviewCatalogue(records, proposals);
    const byId = new Map(records.filter(row => row.pack === "abilities-en").map(row => [row.logicalId, row]));
    const reviewById = new Map(catalogue.entries.map(row => [row.logicalId, row]));
    const details = [];
    for (const id of manifest.ids) {
      const source = byId.get(id);
      const draft = proposals.get(id)?.proposal;
      const review = reviewById.get(id);
      if (!source || !draft || !review) throw new Error("Missing English/FR Ability pair: " + id);
      if (review.errors.length || review.missingFields.length || !review.mechanicalParity ||
        review.translatedFields !== review.sourceFields) {
        throw new Error("Unusable or stale source-backed draft " + id + ": " +
          review.errors.join("; ") + "; missing=" + review.missingFields.join(","));
      }
      details.push({ ...inspectAbilityPair8(id, source.document, draft),
        status: draft.status, provenance: source.document.flags?.cypherFoundry?.crd,
        sourceFile: source.file });
    }
    const statuses = {};
    for (const item of details) statuses[item.status] = (statuses[item.status] ?? 0) + 1;
    const flagged = details.filter(row => row.warningCount);
    const report = {
      version: 1, reference: manifest.reference, batch: manifest.batch,
      sourcePairCount: details.length, statuses,
      flaggedEntries: flagged.length,
      warningCounts: details.reduce((count, row) => count + row.warningCount, 0),
      description: "All source texts and French translations included in detail for human review; cues are advisory, not approvals.",
      details
    };
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
    if (process.argv.includes("--print-pairs")) {
      for (const row of details) {
        console.log("PR8_PAIR:" + JSON.stringify({ id: row.logicalId, EN: row.nameEN,
          FR: row.nameFR, cost: row.cost, tier: row.tier,
          fields: row.fields.map(({ path, english, french, semanticReviewCues }) =>
            ({ path, english, french, flags: semanticReviewCues })) }));
      }
    }
    console.log(JSON.stringify({
      reference: report.reference, batch: report.batch, count: report.sourcePairCount,
      statuses, flagged: flagged.length, warnings: report.warningCounts,
      examples: flagged.slice(0, 70).map(row => ({
        id: row.logicalId, EN: row.nameEN, FR: row.nameFR,
        fields: row.fields.filter(f => f.semanticReviewCues.length).map(f => ({
          path: f.path, cues: f.semanticReviewCues
        }))
      }))
    }, null, 2));
    return report;
  } finally {
    await removeValidationWorkspace(workspace.workspace);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const report = await auditAbilityBatch8();
    if (report.sourcePairCount !== 175) process.exitCode = 1;
  } catch (error) { console.error(error.stack ?? error.message); process.exitCode = 1; }
}
