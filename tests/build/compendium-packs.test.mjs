// Verifies that every authored source pack has a compiled LevelDB directory for Foundry to load.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { withTemporaryDirectory } from "../helpers/temporary-directory.mjs";
import { assertValidationCheckout, createValidationWorkspace, removeValidationWorkspace } from "../../scripts/validation-workspace.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const packsRoot = path.join(root, "packs");
let expectedRoot = root;
if (process.env.CYPHER_TEST_NORMALIZED_SOURCES === "true") {
  await assertValidationCheckout(root);
} else {
  // Standalone builds normalize privately: raw authoring IDs/counts are not the
  // compiler input. Compute that expected input independently, without source writes.
  const expected = await createValidationWorkspace(root);
  expectedRoot = expected.root;
  try {
    await promisify(execFile)(process.execPath, ["scripts/migrate-ability-sources.mjs"],
      { cwd: expectedRoot, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    await removeValidationWorkspace(expected.workspace);
    throw error;
  }
  after(() => removeValidationWorkspace(expected.workspace));
}

const packNames = fs
  .readdirSync(packsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .filter(name => name.endsWith("-en") || name.endsWith("-fr"))
  .filter(name => fs.existsSync(path.join(packsRoot, name.replace(/-fr$/, "-en"), "_source")))
  .sort();

for (const packName of packNames) {
  test(`compiled compendium pack is readable and contains documents: ${packName}`, async () => {
    const directory = path.join(packsRoot, packName);

    assert.ok(fs.existsSync(directory), `Missing pack directory: ${packName}`);
    assert.ok(
      fs.existsSync(path.join(packsRoot, packName.replace(/-fr$/, "-en"), "_source")),
      `Missing source directory: ${packName}`
    );
    assert.ok(
      fs.existsSync(path.join(directory, "CURRENT")),
      `Missing LevelDB CURRENT file: ${packName}`
    );
    assert.ok(
      fs.readdirSync(directory).some(file => file.startsWith("MANIFEST-")),
      `Missing LevelDB manifest: ${packName}`
    );
    await withTemporaryDirectory(async temporary => {
      // Extract a copy: LevelDB may create lock/log metadata even while reading.
      const database = path.join(temporary, "database");
      fs.cpSync(directory, database, { recursive: true, filter: source => path.basename(source) !== "_source" });
      const output = path.join(temporary, "documents");
      await extractPack(database, output);
      const documents = fs.readdirSync(output).filter(file => file.endsWith(".json"))
        .map(file => JSON.parse(fs.readFileSync(path.join(output, file), "utf8")));
      assert.ok(documents.length > 0, `${packName}: empty database`);
      const source = path.join(expectedRoot, "packs", packName.replace(/-fr$/, "-en"), "_source");
      const authored = fs.readdirSync(source, { recursive: true }).filter(file => file.endsWith(".json"))
        .map(file => JSON.parse(fs.readFileSync(path.join(source, file), "utf8")));
      assert.equal(documents.length, authored.length, `${packName}: a source record disappeared during compilation`);
      const authoredIdentities = authored.filter(document => !document._key.startsWith("!folders!"))
        .map(document => document.flags?.cypherFoundry?.crd?.logicalId);
      // Legacy standalone input may acquire provenance during normalization.
      // When input already has identities, compare the complete set, not its size alone.
      if (authoredIdentities.every(Boolean)) {
        const compiledIdentities = documents.filter(document => !document._key.startsWith("!folders!"))
          .map(document => document.flags?.cypherFoundry?.crd?.logicalId);
        assert.deepEqual(compiledIdentities.sort(), authoredIdentities.sort(), `${packName}: changed source identity set`);
      }
      assert.equal(new Set(documents.map(document => document._id)).size, documents.length);
      for (const document of documents) {
        assert.match(document._id, /^[A-Za-z0-9]{16}$/);
        if (packName.startsWith("rules-")) {
          assert.ok(document.pages?.length > 0, `${document.name}: missing journal pages`);
        }
      }
    });
  });
}

test("at least one authored compendium pack exists", () => {
  assert.ok(packNames.length > 0);
});
