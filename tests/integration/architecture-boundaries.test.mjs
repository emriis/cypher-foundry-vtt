import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const MODULE_ROOT = path.resolve(import.meta.dirname, "../../module");

const LAYER_RULES = {
  rules: new Set(["rules", "config.mjs"]),
  "data-models": new Set(["data-models", "config.mjs"]),
  applications: new Set(["applications", "rules", "config.mjs", "import"]),
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

function getLayer(filePath) {
  const relative = path.relative(MODULE_ROOT, filePath);
  return relative.split(path.sep)[0];
}

function getImportedLayer(filePath, specifier) {
  if (!specifier.startsWith(".")) return null;

  const target = path.resolve(path.dirname(filePath), specifier);
  const relative = path.relative(MODULE_ROOT, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  return relative.split(path.sep)[0];
}

function extractStaticImports(source) {
  const imports = [];
  const pattern = /^\s*import(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']\s*;?/gm;

  for (const match of source.matchAll(pattern)) {
    imports.push(match[1]);
  }

  return imports;
}

test("architectural imports respect layer direction", async () => {
  const files = await listJavaScriptFiles(MODULE_ROOT);
  const violations = [];

  for (const filePath of files) {
    const layer = getLayer(filePath);
    const allowed = LAYER_RULES[layer];
    if (!allowed) continue;

    const source = await fs.readFile(filePath, "utf8");
    for (const specifier of extractStaticImports(source)) {
      const importedLayer = getImportedLayer(filePath, specifier);
      if (!importedLayer || importedLayer === layer) continue;

      if (!allowed.has(importedLayer)) {
        violations.push(
          `${path.relative(MODULE_ROOT, filePath)} -> ${specifier}`
        );
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Forbidden architectural imports:\n${violations.join("\n")}`
  );
});

test("rule modules remain independent from Foundry runtime globals", async () => {
  const ruleRoot = path.join(MODULE_ROOT, "rules");
  const files = await listJavaScriptFiles(ruleRoot);
  const violations = [];
  const forbiddenGlobals = /\b(?:game|ui|ChatMessage|foundry|Hooks)\s*\./;

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8");
    if (forbiddenGlobals.test(source)) {
      violations.push(path.relative(MODULE_ROOT, filePath));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Rule modules reference Foundry globals:\n${violations.join("\n")}`
  );
});
