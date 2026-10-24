/** Exercise the standalone CI build without rewriting authoring sources. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { proposedPageId } from "../../scripts/source-migration/id-contract.mjs";
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

test("Given only English authoring sources, when packs build, then reviewed and draft overlays roundtrip without source writes and stale reviews preserve outputs", async () => {
  const { workspace, root } = await createValidationWorkspace(path.resolve(import.meta.dirname, "../.."));
  try {
    // npm test may supply an already normalized checkout. Recreate a supported
    // legacy Focus explicitly so this regression also detects the CI failure there.
    const sourceFile = path.join(root, "packs/foci-en/_source/abides-in-stone.json");
    const source = JSON.parse(await readFile(sourceFile, "utf8"));
    if (source.flags?.cypherFoundry?.crd) delete source.flags.cypherFoundry.crd.logicalId;
    await writeFile(sourceFile, JSON.stringify(source, null, 2) + "\n");
    // French authoring source directories no longer exist in a checkout.
    // This build exercises that absence directly.
    for (const pack of ["abilities", "skills", "descriptors", "types", "foci", "equipment", "rules"]) {
      await assert.rejects(readFile(path.join(root, "packs", pack + "-fr", "_source", "missing.json")),
        error => error.code === "ENOENT");
    }
    // Simulate editorial approval only inside this test's disposable checkout.
    // One existing build exercises effects, table results and embedded journal text.
    const reviewed = new Map();
    for (const relative of ["abilities/a-l/ability.divine-radiance.json",
      "abilities/a-l/ability.apportation.json", "rules/journal.task-difficulty.json"]) {
      const file = path.join(root, "translations/fr", relative);
      const proposal = JSON.parse(await readFile(file, "utf8"));
      proposal.status = "reviewed";
      reviewed.set(proposal.logicalId, proposal);
      await writeFile(file, JSON.stringify(proposal, null, 2) + "\n");
    }
    // Keep this regression's explicit unreviewed-Focus scenario even after
    // the source PR11 approves the Focus in the real authoring tree.
    const reviewFocusFile = path.join(root, "translations/fr/foci/focus.abides-in-stone.json");
    const reviewFocus = JSON.parse(await readFile(reviewFocusFile, "utf8"));
    reviewFocus.status = "proposed";
    await writeFile(reviewFocusFile, JSON.stringify(reviewFocus, null, 2) + "\n");
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

    const frenchAbilitiesDirectory = path.join(workspace, "reviewed-abilities");
    const frenchRulesDirectory = path.join(workspace, "reviewed-rules");
    await extractPack(path.join(root, "packs/abilities-fr"), frenchAbilitiesDirectory);
    await extractPack(path.join(root, "packs/rules-fr"), frenchRulesDirectory);
    const baselineFrenchFociDir = path.join(workspace, "english-fallback-foci");
    await extractPack(path.join(root, "packs/foci-fr"), baselineFrenchFociDir);
    const baselineFocus = (await extractedDocuments(baselineFrenchFociDir))
      .find(document => document.flags?.cypherFoundry?.crd?.logicalId === "focus.abides-in-stone");
    const originalFocus = foci.find(document =>
      document.flags?.cypherFoundry?.crd?.logicalId === "focus.abides-in-stone");
    assert.ok(baselineFocus && originalFocus);
    assert.equal(baselineFocus.name, originalFocus.name);
    assert.equal(baselineFocus.system.description, originalFocus.system.description);
    assert.equal(baselineFocus.flags.cypherFoundry.translation.status, "untranslated");
    assert.equal(baselineFocus.flags.cypherFoundry.translation.sourceLanguage, "en");
    const frenchAbilities = await extractedDocuments(frenchAbilitiesDirectory);
    const lowerTemperature = frenchAbilities.find(document =>
      document.flags?.cypherFoundry?.crd?.logicalId === "ability.lower-temperature");
    const temperatureProposal = JSON.parse(await readFile(
      path.join(root, "translations/fr/abilities/a-l/ability.lower-temperature.json"), "utf8"));
    assert.ok(lowerTemperature, "Missing compiled Lower Temperature ability");
    assert.equal(lowerTemperature.system.description,
      temperatureProposal.fields.find(field => field.path === "system.description").text,
      "The compiled French Ability must match its sole translation authority");
    assert.doesNotMatch(lowerTemperature.system.description, /Farenheit|Celsius\?\?\?/i);
    const frenchRules = await extractedDocuments(frenchRulesDirectory);
    const reviewedDocument = (documents, logicalId) => {
      const document = documents.find(document => document.flags?.cypherFoundry?.crd?.logicalId === logicalId);
      assert.ok(document, `Missing compiled reviewed record: ${logicalId}`);
      assert.equal(document.flags.cypherFoundry.translation.status, "reviewed");
      assert.equal(document.name, reviewed.get(logicalId).fields.find(field => field.path === "name").text);
      return document;
    };
    const expectedText = (id, fieldPath) => {
      const field = reviewed.get(id).fields.find(field => field.path === fieldPath);
      assert.ok(field, `Expected proposal field: ${id}/${fieldPath}`);
      return field.text;
    };
    const radiance = reviewedDocument(frenchAbilities, "ability.divine-radiance");
    for (const effect of ["blessing", "turn-undead"]) {
      const compiled = radiance.system.effects.find(candidate => candidate.id === effect);
      assert.ok(compiled, `Missing translated effect: ${effect}`);
      for (const field of ["name", "description", "effort"]) {
        assert.equal(compiled[field], expectedText("ability.divine-radiance", `system.effects.${effect}.${field}`));
      }
    }
    const apportation = reviewedDocument(frenchAbilities, "ability.apportation");
    const table = apportation.system.rollTables.find(table => table.id === "random-object");
    assert.ok(table, "Compiled table identity must survive translation");
    assert.equal(table.name, expectedText("ability.apportation", "system.rollTables.random-object.name"));
    for (const [index, result] of table.results.entries()) {
      assert.equal(result.description, expectedText("ability.apportation", `system.rollTables.random-object.results.${index}.description`));
    }
    assert.equal(table.results.length, 3);
    const journal = reviewedDocument(frenchRules, "journal.task-difficulty");
    const page = journal.pages.find(page => page._id === proposedPageId("journal.task-difficulty", "b2c3d4e5f6070810"));
    assert.ok(page, "Compiled page identity must survive translation");
    assert.equal(page.name, expectedText("journal.task-difficulty", "pages.b2c3d4e5f6070810.name"));
    assert.equal(page.text.content, expectedText("journal.task-difficulty", "pages.b2c3d4e5f6070810.text.content"));
    assertUnchanged(await snapshot(root), inputs, "Reviewed compilation must not change sources or proposal statuses");

    // Release policy must fail before replacing any generated pack when the
    // catalogue has a mix of reviewed and unreviewed French proposals.
    const preStrictOutputs = await snapshot(root, { generated: true });
    await assert.rejects(build("--require-reviewed"),
      error => /requires a reviewed proposal/i.test(error.stderr));
    assertUnchanged(await snapshot(root, { generated: true }), preStrictOutputs,
      "Strict publication rejection must preserve all compiled packs.");

    const proposalFile = path.join(root, "translations/fr/foci/focus.abides-in-stone.json");
    const proposal = JSON.parse(await readFile(proposalFile, "utf8"));
    await build("--include-proposed");
    const frenchDirectory = path.join(workspace, "french-foci");
    await extractPack(path.join(root, "packs/foci-fr"), frenchDirectory);
    const translated = (await extractedDocuments(frenchDirectory))
      .find(document => document.flags?.cypherFoundry?.crd?.logicalId === "focus.abides-in-stone");
    assert.equal(translated.name, proposal.fields.find(field => field.path === "name").text);
    assert.equal(translated.flags.cypherFoundry.translation.status, "proposed");
    const frenchAbilityIds = new Set(frenchAbilities.filter(document => document.type === "ability").map(document => document._id));
    assert.ok(translated.system.abilities.length > 0);
    for (const uuid of translated.system.abilities) {
      assert.match(uuid, /^Compendium\.cypher\.abilities-fr\.Item\./);
      assert.ok(frenchAbilityIds.has(uuid.split(".").at(-1)), `French Focus reference must resolve: ${uuid}`);
    }
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
