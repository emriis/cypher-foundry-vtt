import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { withTemporaryDirectory } from "../helpers/temporary-directory.mjs";

import {
  auditArchitectureDependencies,
  auditScriptDependencies,
  extractModuleSpecifiers
} from "../../scripts/audit-architecture-dependencies.mjs";

test("dependency extraction includes re-exports and ignores import text in comments and strings", () => {
  const source = `// import ignored from "../documents/fake.mjs";
    export { actor } from "../documents/actor.mjs";
    const text = "import fake from '../documents/text.mjs'";
    const lazy = () => import("../rules/tasks.mjs");`;
  assert.deepEqual(extractModuleSpecifiers(source), ["../documents/actor.mjs", "../rules/tasks.mjs"]);
});

const MODULE_ROOT = path.resolve(import.meta.dirname, "../../module");

test("DataModel preparation may consume pure rules but cannot import application services", async () => {
  await withTemporaryDirectory(async moduleRoot => {
    await fs.mkdir(path.join(moduleRoot, "data-models"));
    const file = path.join(moduleRoot, "data-models/model.mjs");
    await fs.writeFile(file, 'import "../rules/ability-modifiers.mjs";');
    assert.deepEqual(await auditArchitectureDependencies({ moduleRoot }), []);
    await fs.writeFile(file, 'import "../applications/damage-service.mjs";');
    assert.equal((await auditArchitectureDependencies({ moduleRoot })).length, 1);
  });
});

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

test("invalid nested tooling, outside-root, CRD and Node imports are rejected", async () => {
  await withTemporaryDirectory(async root => {
    const moduleRoot = path.join(root, "module"), scriptsRoot = path.join(root, "scripts");
    for (const dir of ["module/rules", "module/crd", "module/documents", "scripts/nested"]) {
      await fs.mkdir(path.join(root, dir), { recursive: true });
    }
    await fs.writeFile(path.join(scriptsRoot, "nested/bad.mjs"), 'import "../../module/documents/actor.mjs";');
    await fs.writeFile(path.join(moduleRoot, "rules/bad.mjs"), 'import "../../scripts/tool.mjs"; import("node:fs");');
    await fs.writeFile(path.join(moduleRoot, "crd/bad.mjs"), 'export { Actor } from "../documents/actor.mjs";');
    const tooling = await auditScriptDependencies({ scriptsRoot, moduleRoot });
    const runtime = await auditArchitectureDependencies({ moduleRoot });
    assert.equal(tooling.length, 1);
    assert.equal(runtime.length, 3);
    assert.ok(runtime.some(value => value.includes("node:fs")));
    await fs.writeFile(path.join(moduleRoot, "rules/bad.mjs"), 'import "../config.mjs";');
    await fs.writeFile(path.join(moduleRoot, "crd/bad.mjs"), 'export { schema } from "./schema.mjs";');
    assert.deepEqual(await auditArchitectureDependencies({ moduleRoot }), []);
  });
});
