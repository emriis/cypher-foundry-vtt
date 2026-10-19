/**
 * Audit production module dependencies against the repository architecture.
 *
 * This script is intentionally independent from Foundry so it can run in CI
 * and during local development without starting a world.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { isBuiltin } from "node:module";

const MODULE_ROOT = path.resolve(import.meta.dirname, "../module");
const SCRIPTS_ROOT = import.meta.dirname;

export const LAYER_RULES = {
  crd: new Set(["crd", "config.mjs"]),
  rules: new Set(["rules", "config.mjs"]),
  // Derived preparation may reuse deterministic rules; persistence and other
  // Foundry orchestration remain forbidden dependencies of DataModels.
  "data-models": new Set(["data-models", "rules", "config.mjs"]),
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
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return "outside-module";

  return relative.split(path.sep)[0];
}

/**
 * Extract imports, re-exports, and literal dynamic imports from parsed source.
 * Parsing excludes comments and strings that merely mention an import.
 * Computed import paths remain outside this audit; syntax checks are separate.
 * @param {string} source Module source text.
 * @returns {string[]} Module specifiers in source order.
 */
export function extractModuleSpecifiers(source) {
  const specifiers = [];
  const parsed = ts.createSourceFile("audit.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifiers.push(node.moduleSpecifier.text);
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return specifiers;
}

/**
 * Compare runtime imports with the allowed dependency direction for each layer.
 * A violation is reported as a source-to-import pair; no file is rewritten.
 * @param {object} [options={}] Optional module root for an isolated audit.
 * @returns {Promise<string[]>} Forbidden cross-layer imports.
 */
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
      if (isBuiltin(specifier)) {
        violations.push(path.relative(moduleRoot, filePath) + " -> " + specifier);
        continue;
      }
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

/**
 * Keep Node tooling from loading Foundry-dependent runtime modules.
 * Only the tooling-safe runtime families accepted below may be referenced.
 * @param {object} [options={}] Script and module roots to inspect.
 * @returns {Promise<string[]>} Forbidden tooling-to-runtime imports.
 */
export async function auditScriptDependencies({
  scriptsRoot = SCRIPTS_ROOT,
  moduleRoot = MODULE_ROOT
} = {}) {
  const files = await listJavaScriptFiles(scriptsRoot);
  const violations = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8");
    for (const specifier of extractModuleSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;

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
