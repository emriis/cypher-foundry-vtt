/**
 * Inventory French editorial coverage in a disposable normalized checkout.
 * Reports distinguish missing, proposed and reviewed text from numeric/markup
 * safeguards and typed mechanical parity. No status certifies prose semantics.
 * --preview writes reviewable French JSON only under the ignored reports directory.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";
import { applyTranslation, mechanicalProjection, sourceHash, translationFields, translationSafetyErrors } from "./localization/compendium-translations.mjs";
import { materializeTranslations } from "./localization/materialize-translations.mjs";
import { parseUniqueJSON } from "./localization/locales.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Read authored document JSON, never generated LevelDB data or private references. */
export async function readCompendiumCatalogue(root) {
  const records = [];
  for (const pack of (await fs.readdir(path.join(root, "packs"))).filter(name => /-(?:en|fr)$/.test(name)).sort()) {
    const directory = path.join(root, "packs", pack, "_source");
    for (const file of (await fs.readdir(directory, { recursive: true })).filter(file => file.endsWith(".json")).sort()) {
      const document = JSON.parse(await fs.readFile(path.join(directory, file), "utf8"));
      if (document._key?.startsWith("!folders!")) continue;
      records.push({ pack, file: path.join("packs", pack, "_source", file).replaceAll(path.sep, "/"),
        logicalId: document.flags?.cypherFoundry?.crd?.logicalId, document });
    }
  }
  return records;
}

/**
 * Reject malformed drafts before build selection can skip their review status.
 * Source freshness and the allowed field inventory remain catalogue checks;
 * this reader checks structure without deriving identity from localized text.
 */
function validateFrenchProposal(proposal, file) {
  const require = (condition, detail) => {
    if (!condition) throw new Error(`${file}: invalid French proposal (${detail}).`);
  };
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const text = value => typeof value === "string" && value.trim();
  require(object(proposal), "expected an object");
  require(text(proposal.logicalId), "logicalId must be nonempty");
  require(proposal.sourceLogicalId === proposal.logicalId, "sourceLogicalId must match logicalId");
  require(proposal.language === "fr", "language must be fr");
  require(["proposed", "reviewed"].includes(proposal.status), "status must be proposed or reviewed");
  require(Array.isArray(proposal.fields) && proposal.fields.length, "fields must be a nonempty array");
  const paths = new Set();
  for (const field of proposal.fields) {
    require(object(field), "each field must be an object");
    require(text(field.path), "field path must be nonempty");
    require(typeof field.sourceHash === "string" && /^[a-f0-9]{64}$/.test(field.sourceHash), "sourceHash must be a lowercase SHA-256 digest");
    require(text(field.text), "translated text must be nonempty");
    if (paths.has(field.path)) throw new Error(`${file}: duplicate translated field ${field.path}.`);
    paths.add(field.path);
  }
}

/** Reject malformed JSON and duplicate ownership before selecting any status. */
export async function readFrenchProposals(root) {
  const directory = path.join(root, "translations", "fr");
  const proposals = new Map();
  for (const file of (await fs.readdir(directory, { recursive: true })).filter(file => file.endsWith(".json")).sort()) {
    const proposal = parseUniqueJSON(await fs.readFile(path.join(directory, file), "utf8"), file);
    validateFrenchProposal(proposal, file);
    if (proposals.has(proposal.logicalId)) throw new Error(`Duplicate French proposal for ${proposal.logicalId}: ${file}`);
    proposals.set(proposal.logicalId, { file: file.replaceAll(path.sep, "/"), proposal });
  }
  return proposals;
}

/** Audit proposal freshness and coverage against current normalized source records. */
export function reviewCatalogue(records, proposals) {
  const english = records.filter(record => record.pack.endsWith("-en"));
  const french = new Map(records.filter(record => record.pack.endsWith("-fr")).map(record => [record.logicalId, record]));
  const references = new Map(records.map(record => [`Compendium.cypher.${record.pack}.Item.${record.document._id}`, `crd:${record.logicalId}`]));
  // Focus graph edges contain scoped Ability document IDs rather than UUIDs.
  for (const record of records.filter(record => record.document.type === "ability")) {
    references.set(record.document._id, `crd:${record.logicalId}`);
  }
  const resolve = value => references.get(value) ?? value;
  const summary = {};
  const entries = english.map(record => {
    const counterpart = french.get(record.logicalId);
    const authored = proposals.get(record.logicalId);
    const sources = translationFields(record.document);
    const errors = [];
    const seen = new Set();
    let translatedFields = 0;
    for (const field of authored?.proposal.fields ?? []) {
      if (seen.has(field.path)) errors.push(`Duplicate field ${field.path}.`);
      seen.add(field.path);
      if (!sources.has(field.path)) errors.push(`Field is not translatable: ${field.path}.`);
      else if (field.sourceHash !== sourceHash(sources.get(field.path))) errors.push(`Stale English source: ${field.path}.`);
      else if (typeof field.text !== "string") errors.push(`Invalid translation: ${field.path}.`);
      else {
        const safety = translationSafetyErrors(sources.get(field.path), field.text, field.path);
        errors.push(...safety);
        if (!safety.length) translatedFields++;
      }
    }
    const missingFields = [...sources.keys()].filter(field => !seen.has(field));
    if (authored && counterpart) {
      try { applyTranslation(record.document, counterpart.document, authored.proposal); }
      catch (error) { if (!errors.length && !missingFields.length) errors.push(error.message); }
    }
    const parity = counterpart && JSON.stringify(mechanicalProjection(record.document, resolve))
      === JSON.stringify(mechanicalProjection(counterpart.document, resolve));
    const status = !authored ? "missing" : errors.length ? "invalid" : missingFields.length ? "incomplete" : authored.proposal.status;
    const family = record.pack.replace(/-en$/, "");
    const counts = summary[family] ??= { entries: 0, sourceFields: 0, translatedFields: 0, statuses: {}, mechanicalDifferences: 0 };
    counts.entries++; counts.sourceFields += sources.size; counts.translatedFields += translatedFields;
    counts.statuses[status] = (counts.statuses[status] ?? 0) + 1;
    if (!parity) counts.mechanicalDifferences++;
    return { logicalId: record.logicalId, name: record.document.name, sourceFile: record.file,
      proposalFile: authored ? `translations/fr/${authored.file}` : null,
      status, sourceFields: sources.size, translatedFields, missingFields,
      mechanicalParity: Boolean(parity), errors };
  });
  const known = new Set(english.map(record => record.logicalId));
  const orphanedProposals = [...proposals.keys()].filter(id => !known.has(id));
  return { scope: "Normalized English/French compendiums; proposals are editorial drafts, not semantic certification.",
    summary, orphanedProposals, entries };
}

/** Produce diagnostic artifacts only; source packs are never modified here. */
export async function reviewTranslations(root = ROOT, { preview = false } = {}) {
  const isolated = await createValidationWorkspace(root);
  try {
    execFileSync(process.execPath, ["scripts/migrate-ability-sources.mjs"], { cwd: isolated.root, stdio: "pipe", windowsHide: true });
    const [records, proposals] = await Promise.all([readCompendiumCatalogue(isolated.root), readFrenchProposals(root)]);
    const report = reviewCatalogue(records, proposals);
    const directory = path.join(root, "reports");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "i18n-content-review.json"), JSON.stringify(report, null, 2) + "\n");
    if (preview) {
      // Complete preflight precedes all preview document writes. The manifest
      // lists this run's outputs, so files from older identities are not current.
      const plan = materializeTranslations(records, proposals, { includeProposed: true });
      for (const [file, translated] of plan) {
        const destination = path.join(directory, "i18n-preview", file);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, JSON.stringify(translated, null, 2) + "\n");
      }
      await fs.writeFile(path.join(directory, "i18n-preview", "manifest.json"), JSON.stringify({
        status: "editorial preview", files: [...plan.keys()].sort()
      }, null, 2) + "\n");
    }
    return report;
  } finally {
    await removeValidationWorkspace(isolated.workspace);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const report = await reviewTranslations(ROOT, { preview: process.argv.includes("--preview") });
    console.log(JSON.stringify({ summary: report.summary, orphanedProposals: report.orphanedProposals }, null, 2));
    if (report.orphanedProposals.length || report.entries.some(entry => ["invalid", "incomplete"].includes(entry.status) || !entry.mechanicalParity)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}
