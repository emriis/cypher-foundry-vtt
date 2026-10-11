/**
 * Read-only comparison of every English authored compendium with the supplied
 * private CRD. Outputs are diagnostic reports, never rewritten pack sources.
 * The optional Python adapter reads Word XML using standard libraries; Node
 * owns the source inventory, comparison policy, and runtime coverage report.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { compareText, abilityPassages, reviewedPassage } from "./crd-audit/text-fidelity.mjs";
import { auditAutomation } from "./crd-audit/automation.mjs";
import { auditAbilityBaseCost } from "./crd-audit/source-fields.mjs";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Inventory all language packs, including nested equipment/descriptor folders. */
async function readEnglishRecords(sourceRoot) {
  const records = [];
  const packs = (await fs.readdir(path.join(sourceRoot, "packs"))).filter(name => name.endsWith("-en")).sort();
  for (const pack of packs) {
    const directory = path.join(sourceRoot, "packs", pack, "_source");
    for (const file of (await fs.readdir(directory, { recursive: true })).filter(file => file.endsWith(".json")).sort()) {
      const absolute = path.join(directory, file);
      const document = JSON.parse(await fs.readFile(absolute, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;
      records.push({ pack, file: path.relative(sourceRoot, absolute).replaceAll(path.sep, "/"), document });
    }
  }
  return records;
}

/** Include source-facing nested text; structured numeric mechanics are audited separately. */
function textFields(document) {
  const fields = [];
  function visit(value, prefix) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const field = `${prefix}.${key}`;
      if (["description", "effort", "properties"].includes(key) && typeof child === "string") fields.push({ field, value: child });
      else if (key === "properties" && Array.isArray(child)) child.forEach((value, index) => {
        if (typeof value === "string") fields.push({ field: `${field}.${index}`, value });
      });
      else if (child && typeof child === "object") visit(child, field);
    }
  }
  if (document.system) visit(document.system, "system");
  for (const [index, page] of (document.pages ?? []).entries()) {
    if (page.text?.content !== undefined) fields.push({ field: `pages.${index}.text.content`, value: page.text.content });
  }
  return fields;
}

/** Produce a reproducible evidence report without exposing an entire private reference. */
export async function auditCompendiums(referencePath, outputPath, sourceRoot = ROOT) {
  const adapter = fileURLToPath(new URL("./crd-audit/read-docx.py", import.meta.url));
  const python = process.env.CRD_AUDIT_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const reference = JSON.parse(execFileSync(python, [adapter, referencePath], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024
  }));
  const records = await readEnglishRecords(sourceRoot);
  const baseline = JSON.parse(await fs.readFile(path.join(sourceRoot, "data/crd-text-fidelity.json"), "utf8"));
  const referenceHash = createHash("sha256").update(await fs.readFile(referencePath)).digest("hex");
  // Reviewed multipart/embedded scopes are reusable only for the exact supplied
  // revision. Re-read their paragraphs from the CRD; a saved hash is not evidence.
  const mappedSections = new Map(baseline.referenceSha256 === referenceHash
    ? baseline.fields.filter(field => field.source.segments || field.source.ranges)
      .map(field => [`${field.file}:${field.field}`, field.source]) : []);
  const abilityNames = [...new Set(records.filter(({ document }) => document.type === "ability").map(({ document }) => document.name))];
  const summary = {};
  const entries = records.map(({ document, pack, file }) => {
    const passages = document.type === "ability" ? abilityPassages(document.name, reference.paragraphs, abilityNames) : [];
    const fields = textFields(document).map(({ field, value }) => {
      const mapped = mappedSections.get(`${file}:${field}`);
      const reviewed = mapped ? reviewedPassage(mapped, reference.paragraphs) : null;
      const assembly = reviewed ? [reviewed] : [];
      const result = compareText(value, reference.paragraphs, assembly.length ? assembly : field === "system.description" ? passages : []);
      return { field, ...result };
    });
    const counts = summary[pack] ??= { entries: 0, textStatuses: {} };
    counts.entries++;
    for (const { status } of fields) counts.textStatuses[status] = (counts.textStatuses[status] ?? 0) + 1;
    const description = fields.find(field => field.field === "system.description");
    const sourceHeaders = (description?.status === "exact-passage" ? description.locators : [])
      .map(locator => reference.paragraphs.find(paragraph => paragraph.index === locator.start));
    return { file, id: document._id, logicalId: document.flags?.cypherFoundry?.crd?.logicalId ?? null,
      name: document.name, type: document.type ?? document.document, fields,
      ...(document.type === "ability" ? { sourceChecks: { baseCost: auditAbilityBaseCost(document.system, sourceHeaders) } } : {}),
      automation: auditAutomation(document) };
  });
  const report = { crdVersion: reference.version,
    referenceSha256: referenceHash,
    sourceMode: sourceRoot === ROOT ? "authored" : "normalized in isolation",
    scope: "English sources; exact-fragment is not a completeness assertion; runtime statuses are conservative consumer inventories",
    summary, entries };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ entries: entries.length, summary, report: path.relative(ROOT, outputPath) }, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const argument = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  let isolated;
  try {
    if (args.includes("--normalized")) {
      isolated = await createValidationWorkspace(ROOT);
      execFileSync(process.execPath, ["scripts/migrate-ability-sources.mjs"], {
        cwd: isolated.root, stdio: "inherit", windowsHide: true
      });
    }
    await auditCompendiums(
      path.resolve(argument("--crd", path.join(ROOT, "docs/local/Cypher-Reference-Document-2026-07-29.docx"))),
      path.resolve(argument("--output", path.join(ROOT, "reports/crd-compendium-audit.json"))),
      isolated?.root ?? ROOT
    );
  } finally {
    if (isolated) await removeValidationWorkspace(isolated.workspace);
  }
}
