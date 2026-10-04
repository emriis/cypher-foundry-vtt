import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  auditArchitectureDependencies,
  auditScriptDependencies,
  extractModuleSpecifiers
} from "../../scripts/audit-architecture-dependencies.mjs";

const MODULE_ROOT = path.resolve(import.meta.dirname, "../../module");

test("architectural imports respect layer direction", async () => {
  const violations = await auditArchitectureDependencies();

  assert.deepEqual(
    violations,
    [],
    "Forbidden architectural imports:\n" + violations.join("\n")
  );
});

test("rule modules remain independent from Foundry runtime globals", async () => {
  const ruleRoot = path.join(MODULE_ROOT, "rules");
  const entries = await fs.readdir(ruleRoot, { withFileTypes: true });
  const violations = [];
  const forbiddenGlobals = /\b(?:game|ui|ChatMessage|foundry|Hooks)\s*\./;

  for (const entry of entries) {
    if (!entry.isFile() || !/\.mjs$/.test(entry.name)) continue;

    const filePath = path.join(ruleRoot, entry.name);
    const source = await fs.readFile(filePath, "utf8");
    if (forbiddenGlobals.test(source)) {
      violations.push(path.relative(MODULE_ROOT, filePath));
    }
  }

  assert.deepEqual(
    violations,
    [],
    "Rule modules reference Foundry globals:\n" + violations.join("\n")
  );
});

test("development scripts do not depend on Foundry UI or document layers", async () => {
  const violations = await auditScriptDependencies();

  assert.deepEqual(
    violations,
    [],
    "Development scripts depend on UI/document modules:\n" +
      violations.join("\n")
  );
});

test("architecture audit recognizes dynamic local imports", () => {
  assert.deepEqual(
    extractModuleSpecifiers('import("./applications/task-service.mjs");'),
    ["./applications/task-service.mjs"]
  );
});
