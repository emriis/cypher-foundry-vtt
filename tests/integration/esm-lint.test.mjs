import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: path.resolve(import.meta.dirname, "../..") });
async function errors(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter(message => message.severity === 2);
}

test("ESM lint accepts explicit imports and rejects extensionless relative imports", async () => {
  assert.deepEqual(await errors('import { value } from "../rules/example.mjs";', "module/applications/example.mjs"), []);
  assert.ok((await errors('import { value } from "../rules/example";', "module/applications/example.mjs"))
    .some(message => message.ruleId === "no-restricted-imports"));
});

test("ESM lint distinguishes pure rules, Foundry runtime, and Node tooling", async () => {
  assert.ok((await errors("game.i18n.localize('key');", "module/rules/example.mjs"))
    .some(message => message.ruleId === "no-undef"));
  assert.deepEqual(await errors("game.i18n.localize('key');", "module/applications/example.mjs"), []);
  assert.ok((await errors('import fs from "node:fs";', "module/applications/example.mjs"))
    .some(message => message.ruleId === "no-restricted-imports"));
  assert.deepEqual(await errors('import fs from "node:fs"; process.cwd();', "scripts/example.mjs"), []);
});

test("browser imports reject bare and dynamic Node APIs without forbidding local lazy loading", async () => {
  for (const code of ['import fs from "fs";', 'import("node:fs");', 'import("fs/promises");']) {
    assert.ok((await errors(code, "module/applications/example.mjs")).length, code);
  }
  assert.deepEqual(await errors('import("../rules/example.mjs");', "module/applications/example.mjs"), []);
});
