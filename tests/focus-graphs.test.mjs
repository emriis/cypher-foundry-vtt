// Checks that Focus ability graphs have valid links and matching translated IDs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function slug(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const englishFoci = new Map(fs.readdirSync(path.join(root, "packs", "foci-en", "_source"))
  .filter(file => file.endsWith(".json"))
  .map(file => [file, JSON.parse(fs.readFileSync(path.join(root, "packs", "foci-en", "_source", file), "utf8"))]));

for (const language of ["en", "fr"]) {
  test(`${language} Focus sources use valid ability flowchart links`, () => {
    const directory = path.join(root, "packs", `foci-${language}`, "_source");
    const sources = fs.readdirSync(directory).filter(file => file.endsWith(".json"));
    assert.ok(sources.length > 0);

    for (const filename of sources) {
      const focus = JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8"));
      assert.equal(focus.type, "focus");
      const abilities = new Map(focus.system.abilities.map(ability => [ability.id, ability]));
      assert.equal(abilities.size, focus.system.abilities.length);

      for (const ability of abilities.values()) {
        assert.ok(ability.id);
        assert.ok(ability.name);
        assert.ok(ability.tier >= 1 && ability.tier <= 6);
        for (const prerequisiteId of ability.prerequisites) {
          const prerequisite = abilities.get(prerequisiteId);
          assert.ok(prerequisite, `${focus.name}/${ability.id} references ${prerequisiteId}`);
          assert.ok(prerequisite.tier <= ability.tier, `${focus.name}/${ability.id} cannot follow a higher tier`);
        }
      }
    }
  });
}

test("Focus ability IDs align between languages and use English CRD slugs", () => {
  const frenchDirectory = path.join(root, "packs", "foci-fr", "_source");
  for (const [filename, english] of englishFoci) {
    const french = JSON.parse(fs.readFileSync(path.join(frenchDirectory, filename), "utf8"));
    assert.equal(french.system.abilities.length, english.system.abilities.length, filename);
    for (let index = 0; index < english.system.abilities.length; index += 1) {
      const englishAbility = english.system.abilities[index];
      const frenchAbility = french.system.abilities[index];
      assert.equal(englishAbility.id, slug(englishAbility.name), `${filename}/ability-${index}`);
      assert.equal(frenchAbility.id, englishAbility.id, `${filename}/ability-${index}/alignment`);
      assert.deepEqual(frenchAbility.prerequisites, englishAbility.prerequisites, `${filename}/ability-${index}/prerequisites`);
    }
  }
});

test("free-use Focus abilities scope their weapon and armor grants", () => {
  const expected = {
    "carries-a-gun.json": { "excellent-gunner": { freeWeaponFamilies: ["firearms"] } },
    "masters-weaponry.json": {
      "battle-competence": {
        freeWeaponCategories: ["light", "medium", "heavy"],
        freeArmorCategories: ["light", "medium", "heavy"]
      },
      "weapon-master": { chooseWeaponAttackCategory: true }
    },
    "stands-like-a-bastion.json": {
      "battle-competence": {
        freeWeaponCategories: ["light", "medium", "heavy"],
        freeArmorCategories: ["light", "medium", "heavy"]
      }
    },
    "builds-allies.json": {
      "automaton-armor-upgrade": { grantedArmorItemCategory: "light" },
      "automaton-heavy-armor-upgrade": { grantedArmorItemCategory: "heavy" }
    }
  };

  for (const [filename, abilities] of Object.entries(expected)) {
    const english = englishFoci.get(filename);
    const french = JSON.parse(fs.readFileSync(path.join(root, "packs", "foci-fr", "_source", filename), "utf8"));
    for (const [abilityId, fields] of Object.entries(abilities)) {
      const englishAbility = english.system.abilities.find(ability => ability.id === abilityId);
      const frenchAbility = french.system.abilities.find(ability => ability.id === abilityId);
      assert.ok(englishAbility, `${filename}/${abilityId} missing in EN`);
      assert.ok(frenchAbility, `${filename}/${abilityId} missing in FR`);
      for (const [field, value] of Object.entries(fields)) {
        assert.deepEqual(englishAbility[field], value, `${filename}/${abilityId}/${field}/EN`);
        assert.deepEqual(frenchAbility[field], value, `${filename}/${abilityId}/${field}/FR`);
      }
    }
  }
});