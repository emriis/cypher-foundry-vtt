/**
 * Audit production module dependencies against the repository architecture.
 *
 * This script is intentionally independent from Foundry so it can run in CI
 * and during local development without starting a world.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MODULE_ROOT = path.resolve(import.meta.dirname, "../module");
const SCRIPTS_ROOT = import.meta.dirname;

export const LAYER_RULES = {
  rules: new Set(["rules", "config.mjs"]),
  "data-models": new Set(["data-models", "config.mjs"]),
  applications: new Set(["applications", "rules", "config.mjs"]),
  documents: new Set(["documents", "applications", "rules", "config.mjs"]),
  sheets: new Set([
    "sheets",
    "applications",
    "documents",
    "config.mjs",
    "abilities.mjs"
  ]),
  migrations: new Set(["migrations", "config.mjs", "rules"]),
  import: new Set(["import", "applications", "config.mjs"])
};

export const ROOT_MODULE_RULES = {
  "abilities.mjs": new Set(["abilities.mjs"]),
  "config.mjs": new Set(["config.mjs"]),
  "import.mjs": new Set(["import", "applications", "config.mjs"]),
  "migration.mjs": new Set(["migrations", "config.mjs"])
};

async function listJavaScriptFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJavaScriptFiles(entryPath));
    } else if (/\.mjs$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function getLayer(filePath, moduleRoot) {
  const relative = path.relative(moduleRoot, filePath);
  return relative.split(path.sep)[0];
}

function getAllowedImports(filePath, moduleRoot) {
  const relative = path.relative(moduleRoot, filePath);
  if (!relative.includes(path.sep)) {
    return ROOT_MODULE_RULES[relative] ?? null;
  }

  return LAYER_RULES[getLayer(filePath, moduleRoot)] ?? null;
}

function getImportedLayer(filePath, specifier, moduleRoot) {
  if (!specifier.startsWith(".")) return null;

  const target = path.resolve(path.dirname(filePath), specifier);
  const relative = path.relative(moduleRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  return relative.split(path.sep)[0];
}

export function extractModuleSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

export async function auditArchitectureDependencies({
  moduleRoot = MODULE_ROOT
} = {}) {
  const files = await listJavaScriptFiles(moduleRoot);
  const violations = [];

  for (const filePath of files) {
    const allowed = getAllowedImports(filePath, moduleRoot);
    if (!allowed) continue;

    const source = await fs.readFile(filePath, "utf8");
    for (const specifier of extractModuleSpecifiers(source)) {
      const importedLayer = getImportedLayer(
        filePath,
        specifier,
        moduleRoot
      );
      if (
        !importedLayer ||
        importedLayer === getLayer(filePath, moduleRoot)
      ) {
        continue;
      }

      if (!allowed.has(importedLayer)) {
        violations.push(
          path.relative(moduleRoot, filePath) + " -> " + specifier
        );
      }
    }
  }

  return violations;
}

export async function auditScriptDependencies({
  scriptsRoot = SCRIPTS_ROOT,
  moduleRoot = MODULE_ROOT
} = {}) {
  const files = await listJavaScriptFiles(scriptsRoot);
  const violations = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8");
    for (const specifier of extractModuleSpecifiers(source)) {
      if (!specifier.startsWith("../module/")) continue;

      const target = path.resolve(path.dirname(filePath), specifier);
      const relative = path.relative(moduleRoot, target);
      if (
        relative.startsWith("documents" + path.sep) ||
        relative.startsWith("sheets" + path.sep)
      ) {
        violations.push(
          path.relative(scriptsRoot, filePath) + " -> " + specifier
        );
      }
    }
  }

  return violations;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [architectureViolations, scriptViolations] = await Promise.all([
    auditArchitectureDependencies(),
    auditScriptDependencies()
  ]);

  const violations = [
    ...architectureViolations,
    ...scriptViolations.map(value => "scripts: " + value)
  ];

  if (violations.length > 0) {
    console.error("Architecture dependency violations:");
    for (const violation of violations) {
      console.error("- " + violation);
    }
    process.exitCode = 1;
  } else {
    console.log("Architecture dependency audit passed.");
  }
}
