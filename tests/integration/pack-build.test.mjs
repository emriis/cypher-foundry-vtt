/** Exercise the standalone CI build without rewriting authoring sources. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { createValidationWorkspace, removeValidationWorkspace } from "../../scripts/validation-workspace.mjs";

/** Hash all authoring inputs or generated outputs, reporting only changed paths. */
async function snapshot(root, { generated = false } = {}) {
  const entries = [];
  for (const directory of generated ? ["packs"] : ["packs", "translations"]) {
    for (const file of await readdir(path.join(root, directory), { recursive: true, withFileTypes: true })) {
      if (!file.isFile()) continue;
      const absolute = path.join(file.parentPath, file.name);
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
      const authoring = relative.includes("/_source/") || relative.startsWith("translations/");
      if (generated === authoring) continue;
      entries.push([relative, createHash("sha256").update(await readFile(absolute)).digest("hex")]);
    }
  }
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function assertUnchanged(actual, expected, message) {
  const files = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  assert.deepEqual([...files].filter(file => actual[file] !== expected[file]).sort(), [], message);
}

async function extractedDocuments(directory) {
  return Promise.all((await readdir(directory)).filter(file => file.endsWith(".json"))
    .map(async file => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
}

test("Given legacy bilingual authoring sources, when standalone packs build, then identities and draft translations compile without source writes and stale reviews preserve existing outputs", async () => {
  const { workspace, root } = await createValidationWorkspace(path.resolve(import.meta.dirname, "../.."));
  try {
    // npm test may supply an already normalized checkout. Recreate a supported
    // legacy Focus explicitly so this regression also detects the CI failure there.
    const sourceFile = path.join(root, "packs/foci-en/_source/abides-in-stone.json");
    const source = JSON.parse(await readFile(sourceFile, "utf8"));
    if (source.flags?.cypherFoundry?.crd) delete source.flags.cypherFoundry.crd.logicalId;
    await writeFile(sourceFile, JSON.stringify(source, null, 2) + "\n");
    const inputs = await snapshot(root);
    const build = (...args) => promisify(execFile)(process.execPath, ["scripts/build-packs.mjs", ...args],
      { cwd: root, maxBuffer: 8 * 1024 * 1024 });

    await build();
    const englishDirectory = path.join(workspace, "english-foci");
    const abilitiesDirectory = path.join(workspace, "english-abilities");
    await extractPack(path.join(root, "packs/foci-en"), englishDirectory);
    await extractPack(path.join(root, "packs/abilities-en"), abilitiesDirectory);
    const foci = (await extractedDocuments(englishDirectory)).filter(document => document.type === "focus");
    const abilities = (await extractedDocuments(abilitiesDirectory)).filter(document => document.type === "ability");
    const abilityIds = new Set(abilities.map(document => document._id));
    assert.ok(foci.length && abilities.length, "Compiled packs must contain actual documents");
    for (const document of [...foci, ...abilities]) {
      assert.match(document._id, /^[A-Za-z0-9]{16}$/);
      assert.ok(document.flags?.cypherFoundry?.crd?.logicalId, "Compiled documents must carry their CRD identity");
    }
    for (const focus of foci) {
      for (const uuid of focus.system.abilities) {
        assert.ok(abilityIds.has(uuid.split(".").at(-1)), `${focus.name}: ${uuid} must resolve in the compiled Ability pack`);
      }
    }

    const proposalFile = path.join(root, "translations/fr/foci/focus.abides-in-stone.json");
    const proposal = JSON.parse(await readFile(proposalFile, "utf8"));
    await build("--include-proposed");
    const frenchDirectory = path.join(workspace, "french-foci");
    await extractPack(path.join(root, "packs/foci-fr"), frenchDirectory);
    const translated = (await extractedDocuments(frenchDirectory))
      .find(document => document.flags?.cypherFoundry?.crd?.logicalId === "focus.abides-in-stone");
    assert.equal(translated.name, proposal.fields.find(field => field.path === "name").text);
    assert.equal(translated.flags.cypherFoundry.translation.status, "proposed");
    assertUnchanged(await snapshot(root), inputs, "Both build modes must preserve all authored sources and proposals");

    // A selected stale review fails before any previously compiled pack changes.
    proposal.status = "reviewed";
    proposal.fields[0].sourceHash = "0".repeat(64);
    await writeFile(proposalFile, JSON.stringify(proposal, null, 2) + "\n");
    const staleInputs = await snapshot(root);
    const outputs = await snapshot(root, { generated: true });
    await assert.rejects(build(), error => /stale/i.test(error.stderr));
    assertUnchanged(await snapshot(root), staleInputs, "Rejected builds must preserve their authoring inputs");
    assertUnchanged(await snapshot(root, { generated: true }), outputs, "Rejected builds must preserve existing compiled packs");
  } finally {
    await removeValidationWorkspace(workspace);
  }
});
