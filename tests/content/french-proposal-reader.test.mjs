/** Invalid editorial files must fail before a normal build skips draft text. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readFrenchProposals } from "../../scripts/review-translations.mjs";

function proposal() {
  return { logicalId: "ability.example", sourceLogicalId: "ability.example", language: "fr", status: "proposed",
    fields: [{ path: "name", sourceHash: "a".repeat(64), text: "Exemple" }] };
}

/** Each fixture owns one temporary translation root and removes only that root. */
async function withFile(source, callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cypher-proposal-reader-"));
  try {
    const directory = path.join(root, "translations", "fr");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "example.json"), source);
    await callback(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("Given a valid proposed or reviewed editorial file, when proposals are read, then the exact status and legacy identity are preserved", async () => {
  for (const status of ["proposed", "reviewed"]) {
    const value = proposal();
    value.status = status;
    value.logicalId = value.sourceLogicalId = "equipment.Fantasy.inexpensive.Arrows (12)";
    await withFile(JSON.stringify(value), async root => {
      const result = await readFrenchProposals(root);
      assert.deepEqual(result.get(value.logicalId), { file: "example.json", proposal: value });
    });
  }
});

test("Given malformed proposal identity, review status or field shapes, when authoring files are read, then no malformed draft can silently bypass a normal build", async () => {
  const invalid = [{ ...proposal(), status: "reviewd" }, null, [], "text", {},
    { ...proposal(), logicalId: "" }, { ...proposal(), sourceLogicalId: "ability.other" },
    { ...proposal(), language: "en" },
    { ...proposal(), fields: null }, { ...proposal(), fields: {} }, { ...proposal(), fields: [] },
    { ...proposal(), fields: [null] }, { ...proposal(), fields: [[]] },
    { ...proposal(), fields: [{ path: "", sourceHash: "a".repeat(64), text: "Exemple" }] },
    { ...proposal(), fields: [{ path: "name", sourceHash: "stale", text: "Exemple" }] },
    { ...proposal(), fields: [{ path: "name", sourceHash: "a".repeat(64), text: 3 }] },
    { ...proposal(), fields: [{ path: "name", sourceHash: "a".repeat(64), text: " " }] }];
  for (const value of invalid) {
    await withFile(JSON.stringify(value), root => assert.rejects(readFrenchProposals(root), /example\.json.*invalid French proposal/i));
  }
});

test("Given repeated JSON members or field paths, when proposals are read, then neither review status nor translated text is silently overwritten", async () => {
  const source = JSON.stringify(proposal());
  const duplicateStatus = source.replace('"status":"proposed"', '"status":"proposed","status":"reviewed"');
  const escapedDuplicateStatus = source.replace('"status":"proposed"', '"status":"proposed","sta\\u0074us":"reviewed"');
  const duplicatePathMember = source.replace('"path":"name"', '"path":"name","path":"system.description"');
  for (const value of [duplicateStatus, escapedDuplicateStatus, duplicatePathMember]) {
    await withFile(value, root => assert.rejects(readFrenchProposals(root), /example\.json.*duplicate (?:JSON member|key)/i));
  }
  const duplicatePaths = proposal();
  duplicatePaths.fields.push({ ...duplicatePaths.fields[0], text: "Autre texte" });
  await withFile(JSON.stringify(duplicatePaths), root => assert.rejects(readFrenchProposals(root), /example\.json.*duplicate translated field.*name/i));
});
