/** End-to-end migration contract with owned miniature bilingual compendiums. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrateCanonicalIds } from "../../scripts/source-migration/canonical-ids.mjs";
import { proposedFoundryId, proposedFolderId, proposedPageId } from "../../scripts/source-migration/id-contract.mjs";

async function withCatalogue(callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cypher-id-migration-"));
  const files = new Map();
  async function add(pack, name, document) {
    const file = path.join(root, "packs", pack, "_source", name + ".json");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(document, null, 2) + "\n");
    files.set(pack + "/" + name, file);
  }
  async function read(pack, name) {
    return JSON.parse(await fs.readFile(files.get(pack + "/" + name), "utf8"));
  }
  try {
    await callback({ root, add, read, files });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function item(logicalId, id, language, type, system = {}, folder = null) {
  return { document: "Item", type, name: language === "fr" ? "Nom français" : "English name",
    _id: id, _key: "!items!" + id, folder, system,
    flags: { cypherFoundry: { crd: { logicalId, language,
      ...(language === "fr" ? { sourceLogicalId: logicalId } : {}) } } } };
}

test("canonical migration preserves all bilingual links, folders and Journal pages on repeat", async () => {
  await withCatalogue(async ({ root, add, read, files }) => {
    const oldEn = "aaaaaaaaaaaaaaaa", oldFr = "bbbbbbbbbbbbbbbb";
    const oldFocus = "cccccccccccccccc";
    const oldFolderEn = "dddddddddddddddd", oldFolderFr = "eeeeeeeeeeeeeeee";
    const enUuid = "Compendium.cypher.abilities-en.Item." + oldEn;
    const frUuid = "Compendium.cypher.abilities-fr.Item." + oldFr;
    const abilityLogical = "ability.summon-light";
    const folder = id => ({ _id: id, _key: "!folders!" + id,
      name: "General", type: "Item", folder: null });
    await add("descriptors-en", "folder-general", folder(oldFolderEn));
    await add("descriptors-fr", "folder-general", folder(oldFolderFr));
    await add("descriptors-en", "example", item("descriptor.example", "1111111111111111", "en",
      "descriptor", { description: "A descriptor." }, oldFolderEn));
    await add("descriptors-fr", "example", item("descriptor.example", "2222222222222222", "fr",
      "descriptor", { description: "Un descripteur." }, oldFolderFr));
    await add("abilities-en", "light", item(abilityLogical, oldEn, "en",
      "ability", { key: "summon-light", description: "Summon light." }));
    await add("abilities-fr", "light", item(abilityLogical, oldFr, "fr",
      "ability", { key: "summon-light", description: "Invoque la lumière." }));
    await add("foci-en", "focus", item("focus.illumination", oldFocus, "en", "focus", {
      description: "A Focus.", abilities: [enUuid], abilityTiers: [{ ability: enUuid, tier: 1 }],
      flowchart: { edges: [{ from: oldEn, to: oldEn }] }
    }));
    await add("foci-fr", "focus", item("focus.illumination", oldFocus, "fr", "focus", {
      description: "Un Focus.", abilities: [frUuid], abilityTiers: [{ ability: frUuid, tier: 1 }],
      flowchart: { edges: [{ from: oldFr, to: oldFr }] }
    }));
    const rule = (language, id, oldPage) => ({
      document: "JournalEntry", _id: id, _key: "!journal!" + id,
      name: language === "fr" ? "Règles" : "Rules",
      pages: [{ _id: oldPage, _key: "!journal.pages!" + id + "." + oldPage, type: "text",
        name: "Example", text: { content: "<p>@UUID[" +
          (language === "fr" ? frUuid : enUuid) + "]</p>" } }],
      flags: { cypherFoundry: { crd: { logicalId: "journal.example", language,
        ...(language === "fr" ? { sourceLogicalId: "journal.example" } : {}) } } }
    });
    await add("rules-en", "rule", rule("en", "3333333333333333", "4444444444444444"));
    await add("rules-fr", "rule", rule("fr", "5555555555555555", "6666666666666666"));

    const first = await migrateCanonicalIds(root);
    assert.equal(first.pairs, 4);
    const expectedAbilityId = proposedFoundryId(abilityLogical);
    const abilityEn = await read("abilities-en", "light");
    const abilityFr = await read("abilities-fr", "light");
    assert.equal(abilityEn._id, expectedAbilityId);
    assert.equal(abilityFr._id, expectedAbilityId);
    assert.equal(abilityFr.flags.cypherFoundry.crd.sourceLogicalId, abilityLogical);
    const focusEn = await read("foci-en", "focus");
    const focusFr = await read("foci-fr", "focus");
    assert.equal(focusEn._id, focusFr._id);
    assert.equal(focusEn.system.abilities[0], "Compendium.cypher.abilities-en.Item." + expectedAbilityId);
    assert.equal(focusFr.system.abilities[0], "Compendium.cypher.abilities-fr.Item." + expectedAbilityId);
    assert.equal(focusFr.system.abilityTiers[0].ability, focusFr.system.abilities[0]);
    assert.deepEqual(focusEn.system.flowchart.edges, [{ from: expectedAbilityId, to: expectedAbilityId }]);
    assert.deepEqual(focusFr.system.flowchart.edges, focusEn.system.flowchart.edges);
    const dEn = await read("descriptors-en", "example");
    const dFr = await read("descriptors-fr", "example");
    assert.equal(dEn.folder, proposedFolderId("descriptors", "folder-general.json"));
    assert.equal(dFr.folder, dEn.folder);
    const pageEn = (await read("rules-en", "rule")).pages[0];
    const pageFr = (await read("rules-fr", "rule")).pages[0];
    assert.equal(pageEn._id, proposedPageId("journal.example", "4444444444444444"));
    assert.equal(pageFr._id, pageEn._id);
    assert.ok(pageFr.text.content.includes("Compendium.cypher.abilities-fr.Item." + expectedAbilityId));

    const before = await Promise.all([...files.values()].map(file => fs.readFile(file, "utf8")));
    const again = await migrateCanonicalIds(root);
    assert.equal(again.pairs, 4);
    const after = await Promise.all([...files.values()].map(file => fs.readFile(file, "utf8")));
    assert.deepEqual(after, before, "Repeated canonical identity migration must be byte-identical.");
  });
});

test("canonical migration rejects unresolved Foundry UUIDs rather than guessing", async () => {
  await withCatalogue(async ({ root, add }) => {
    const broken = "Compendium.cypher.abilities-en.Item.ffffffffffffffff";
    await add("abilities-en", "one", item("ability.one", "aaaaaaaaaaaaaaaa", "en",
      "ability", { description: broken }));
    await add("abilities-fr", "one", item("ability.one", "bbbbbbbbbbbbbbbb", "fr",
      "ability", { description: "Une aptitude." }));
    await assert.rejects(migrateCanonicalIds(root), /Unresolved Cypher compendium UUID/);
  });
});

test("canonical migration slugifies only canonical English identity, never translated name", async () => {
  await withCatalogue(async ({ root, add, read }) => {
    const englishId = "equipment.Fantasy.inexpensive.Arrows (12)";
    await add("equipment-en", "english", item(englishId, "1111111111111111", "en",
      "equipment", { description: "Twelve arrows." }));
    await add("equipment-fr", "french", item(englishId, "2222222222222222", "fr",
      "equipment", { description: "Douze flèches." }));
    await migrateCanonicalIds(root);
    const en = await read("equipment-en", "english");
    const fr = await read("equipment-fr", "french");
    assert.equal(en.flags.cypherFoundry.crd.logicalId, "equipment.fantasy.inexpensive.arrows-12");
    assert.equal(fr.flags.cypherFoundry.crd.logicalId, en.flags.cypherFoundry.crd.logicalId);
    assert.equal(fr._id, en._id);
  });
});
