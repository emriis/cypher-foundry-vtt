/**
 * Read-only preflight for the bilingual Foundry document-ID migration.
 *
 * Authored files may contain legacy IDs; the normalizer currently rewrites
 * several families. Run that normalizer only in an owned temporary checkout,
 * then compare its distributable identities with the untouched authoring IDs.
 * This module never changes compendium sources or generated LevelDB packs.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readCompendiumCatalogue } from "./review-translations.mjs";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const FOUNDRY_ID = /^[A-Za-z0-9]{16}$/;
const UUID_REFERENCE = /Compendium\.cypher\.([A-Za-z0-9-]+)\.(Item|JournalEntry)\.([A-Za-z0-9]{16})/g;

/** Normalize a human-readable source identity component without using French text. */
export function identitySlug(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Propose a stable, language-neutral logical ID for PR2.
 * Existing equipment IDs include the English genre/price/name tuple; retain
 * all its components before sluggifying. Any collision is reported, not guessed.
 * @param {string} logicalId Canonical English source ID from normalized records.
 * @returns {string} Candidate identity, never applied by this audit.
 */
export function proposedLogicalId(logicalId) {
  if (typeof logicalId !== "string" || !logicalId.trim()) {
    throw new Error("Missing canonical English logicalId.");
  }
  const components = logicalId.split(".");
  if (components.some(component => !identitySlug(component))) {
    throw new Error("Cannot normalize logicalId: " + logicalId);
  }
  return components.map(identitySlug).join(".");
}

/**
 * Foundry accepts sixteen ASCII alphanumerics for document IDs. The full
 * proposed canonical logical ID is hashed; display names and locale never enter.
 * @param {string} logicalId Proposed language-neutral ID.
 * @returns {string} Deterministic 16-character hexadecimal Foundry document ID.
 */
export function proposedFoundryId(logicalId) {
  if (!logicalId) throw new Error("Cannot hash an empty logicalId.");
  return createHash("sha256").update(logicalId, "utf8").digest("hex").slice(0, 16);
}

function documentKind(document) {
  return document.document === "JournalEntry" ? "JournalEntry" : "Item";
}

function documentUuid(pack, document) {
  return "Compendium.cypher." + pack + "." + documentKind(document) + "." + document._id;
}

function inspectEntry(record, authoring, canonicalId, targetId) {
  const document = record.document;
  const source = authoring.get(record.file);
  const kind = documentKind(document);
  return {
    pack: record.pack,
    file: record.file,
    name: document.name,
    type: document.type ?? document.crdType ?? kind,
    currentId: document._id,
    authoringId: source?.document._id ?? null,
    proposedId: targetId,
    currentUuid: documentUuid(record.pack, document),
    proposedUuid: "Compendium.cypher." + record.pack + "." + kind + "." + targetId,
    currentKey: document._key,
    proposedKey: (kind === "JournalEntry" ? "!journal!" : "!items!") + targetId,
    sourceLogicalId: document.flags?.cypherFoundry?.crd?.sourceLogicalId ?? null,
    pages: (document.pages ?? []).map((page, index) => ({
      index,
      currentId: page._id,
      currentKey: page._key,
      // Keep the stable EN page identity as the pairing anchor (see pairPages).
      proposedId: null
    }))
  };
}

function addIssue(issues, category, value) {
  issues[category].push(value);
}

function findReferences(value, location, output) {
  if (typeof value === "string") {
    for (const match of value.matchAll(UUID_REFERENCE)) {
      output.push({ location, uuid: match[0], pack: match[1], kind: match[2], id: match[3] });
    }
  } else if (Array.isArray(value)) {
    for (const [i, child] of value.entries()) findReferences(child, location + "." + i, output);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) findReferences(child, location + "." + key, output);
  }
}

function pairPages(english, french, targetLogicalId, issues) {
  const enPages = english?.pages ?? [];
  const frPages = french?.pages ?? [];
  if (enPages.length !== frPages.length) {
    addIssue(issues, "journalPageMismatches", {
      logicalId: targetLogicalId, english: enPages.length, french: frPages.length
    });
  }
  for (const [index, page] of enPages.entries()) {
    const anchor = page.currentId ?? "ordinal-" + index;
    const target = proposedFoundryId(targetLogicalId + ":page:" + anchor);
    page.proposedId = target;
    if (frPages[index]) frPages[index].proposedId = target;
  }
}

/**
 * Produce the complete proposed EN/FR migration map without rewriting records.
 * Missing pairs, collisions, ambiguous identities and dangling links are
 * diagnostics, not automatic repairs or an excuse to drop records.
 * @param {object[]} records Normalized bilingual catalogue entries.
 * @param {object[]} authored Optional unnormalized entries for original _ids.
 * @returns {object} Deterministic detailed report and issue inventory.
 */
export function auditIdentityCatalogue(records, authored = []) {
  const bySourcePath = new Map(authored.map(record => [record.file, record]));
  const issues = {
    missingLogicalIds: [], duplicateLogicalIds: [], missingCounterparts: [],
    logicalSlugCollisions: [], proposedIdCollisions: [], existingIdCollisions: [],
    invalidCurrentIds: [], danglingUuidReferences: [], danglingFocusEdges: [],
    journalPageMismatches: []
  };
  const groups = new Map();
  const packIds = new Map();
  const currentUuids = new Map();
  const normalizedSlugs = new Map();

  for (const record of records) {
    const language = record.pack.endsWith("-fr") ? "fr" : "en";
    const id = record.logicalId;
    if (!id) {
      addIssue(issues, "missingLogicalIds", { pack: record.pack, file: record.file });
      continue;
    }
    const groupKey = record.pack.replace(/-(en|fr)$/, "") + ":" + id;
    const group = groups.get(groupKey) ?? { family: record.pack.replace(/-(en|fr)$/, ""), logicalId: id };
    if (group[language]) {
      addIssue(issues, "duplicateLogicalIds", { family: group.family, language, logicalId: id,
        files: [group[language].file, record.file] });
      continue;
    }
    const candidate = proposedLogicalId(id);
    const target = proposedFoundryId(candidate);
    group.proposedLogicalId = candidate;
    group[language] = inspectEntry(record, bySourcePath, candidate, target);
    groups.set(groupKey, group);

    const scopedSource = record.pack + ":" + record.document._id;
    if (packIds.has(scopedSource)) addIssue(issues, "existingIdCollisions",
      { pack: record.pack, id: record.document._id, files: [packIds.get(scopedSource), record.file] });
    packIds.set(scopedSource, record.file);
    currentUuids.set(documentUuid(record.pack, record.document), record);

    if (!FOUNDRY_ID.test(record.document._id)) {
      addIssue(issues, "invalidCurrentIds", { file: record.file, id: record.document._id });
    }
    const slugOwners = normalizedSlugs.get(candidate) ?? new Set();
    slugOwners.add(id);
    normalizedSlugs.set(candidate, slugOwners);
  }

  for (const [candidate, owners] of normalizedSlugs) {
    if (owners.size > 1) addIssue(issues, "logicalSlugCollisions",
      { proposedLogicalId: candidate, existingLogicalIds: [...owners].sort() });
  }

  const entries = [...groups.values()].sort((a, b) => a.family.localeCompare(b.family, "en") ||
    a.logicalId.localeCompare(b.logicalId, "en"));
  const projected = new Map();
  const summary = {};

  for (const group of entries) {
    const family = summary[group.family] ??= {
      pairs: 0, english: 0, french: 0, matchingCurrentIds: 0, differingCurrentIds: 0,
      requiringIdChangeEn: 0, requiringIdChangeFr: 0, requiringLogicalIdChange: 0
    };
    if (group.en) family.english++;
    if (group.fr) family.french++;
    if (!group.en || !group.fr) addIssue(issues, "missingCounterparts",
      { logicalId: group.logicalId, family: group.family, missing: group.en ? "fr" : "en" });
    else {
      family.pairs++;
      if (group.en.currentId === group.fr.currentId) family.matchingCurrentIds++;
      else family.differingCurrentIds++;
    }
    if (group.en?.currentId !== group.en?.proposedId && group.en) family.requiringIdChangeEn++;
    if (group.fr?.currentId !== group.fr?.proposedId && group.fr) family.requiringIdChangeFr++;
    if (group.logicalId !== group.proposedLogicalId) family.requiringLogicalIdChange++;

    pairPages(group.en, group.fr, group.proposedLogicalId, issues);
    for (const item of [group.en, group.fr]) {
      if (!item) continue;
      const key = item.pack + ":" + item.proposedId;
      if (projected.has(key) && projected.get(key) !== group.logicalId) {
        addIssue(issues, "proposedIdCollisions", {
          pack: item.pack, proposedId: item.proposedId,
          logicalIds: [projected.get(key), group.logicalId].sort()
        });
      }
      projected.set(key, group.logicalId);
    }
  }

  const references = [];
  for (const record of records) {
    const found = [];
    findReferences(record.document.system, "system", found);
    findReferences(record.document.pages, "pages", found);
    for (const ref of found) {
      const destination = currentUuids.get(ref.uuid);
      const mapped = destination && groups.get(destination.pack.replace(/-(en|fr)$/, "") + ":" + destination.logicalId);
      const counterpart = mapped?.[destination.pack.endsWith("-fr") ? "fr" : "en"];
      references.push({
        source: record.file, location: ref.location, currentUuid: ref.uuid,
        proposedUuid: counterpart?.proposedUuid ?? null
      });
      if (!destination) addIssue(issues, "danglingUuidReferences",
        { source: record.file, location: ref.location, uuid: ref.uuid });
    }
    if (record.document.type === "focus") {
      const abilityPack = "abilities-" + (record.pack.endsWith("-fr") ? "fr" : "en");
      for (const [index, edge] of (record.document.system?.flowchart?.edges ?? []).entries()) {
        for (const endpoint of ["from", "to"]) {
          if (!packIds.has(abilityPack + ":" + edge[endpoint])) {
            addIssue(issues, "danglingFocusEdges", {
              source: record.file, index, endpoint, id: edge[endpoint]
            });
          }
        }
      }
    }
  }

  return {
    schemaVersion: 1,
    scope: "Normalized CRD Item/JournalEntry sources; read-only migration proposal, not applied IDs.",
    targetPolicy: "SHA-256(proposedLogicalId UTF-8).slice(0,16); EN/FR share that ID.",
    summary,
    issueCounts: Object.fromEntries(Object.entries(issues).map(([key, values]) => [key, values.length])),
    issues,
    entries,
    references: references.sort((a, b) => a.source.localeCompare(b.source, "en") ||
      a.location.localeCompare(b.location, "en"))
  };
}

/** Compare the current raw catalogue to a disposable, normalized checkout. */
export async function runIdentityAudit(root = ROOT) {
  const authored = await readCompendiumCatalogue(root);
  const isolated = await createValidationWorkspace(root);
  try {
    execFileSync(process.execPath, ["scripts/migrate-ability-sources.mjs"],
      { cwd: isolated.root, windowsHide: true, stdio: "pipe" });
    const normalized = await readCompendiumCatalogue(isolated.root);
    return auditIdentityCatalogue(normalized, authored);
  } finally {
    await removeValidationWorkspace(isolated.workspace);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const report = await runIdentityAudit();
    const outputFlag = process.argv.indexOf("--output");
    const output = outputFlag >= 0 ? process.argv[outputFlag + 1] : "reports/compendium-identity-audit.json";
    if (!output) throw new Error("--output requires a path.");
    const filename = path.resolve(ROOT, output);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output: filename, summary: report.summary, issueCounts: report.issueCounts }, null, 2));
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  }
}
