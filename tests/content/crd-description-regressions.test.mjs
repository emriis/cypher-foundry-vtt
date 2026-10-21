import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";

const root = path.resolve(import.meta.dirname, "../..");

// Independent transcriptions from CRD Type abilities, not snapshots generated
// from pack JSON. Neighbouring abilities and GM callouts are separate passages.
const passages = [
  ["slice-and-step", "Sword Fighter — Slice and Step",
    "You reposition your foe or yourself an immediate distance away, easing your attack on your next turn (whether against that foe or a different one). Action."],
  ["head-trauma", "Axe Fighter — Head Trauma",
    "The attack inflicts 1 less damage, but the foe’s actions are hindered until they use an action to recover. Action."],
  ["let-them-bleed", "Knife Fighter — Let Them Bleed",
    "The wound bleeds; on your next turn, the foe takes 2 damage that ignores armor. Action."]
];

test("Given separate CRD Ability passages, then English descriptions exclude adjacent GM intrusions", () => {
  const records = fs.readdirSync(path.join(root, "packs/abilities-en/_source"))
    .filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(path.join(root, "packs/abilities-en/_source", file), "utf8")));
  for (const [key, locator, expected] of passages) {
    const matches = records.filter(record => record.system?.key === key);
    assert.ok(matches.length, locator);
    for (const record of matches) assert.equal(plainText(record.system.description), expected, locator);
  }
});

test("Given separate CRD equipment table rows, then Climbing gear does not include the Communicator row", () => {
  for (const language of ["en", "fr"]) {
    const directory = path.join(root, `packs/equipment-${language}/_source/science-fiction`);
    const record = fs.readdirSync(directory).filter(file => file.endsWith(".json"))
      .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")))
      .find(record => record.name === "Climbing gear");
    assert.equal(plainText(record.system.description), "Asset for climbing tasks");
  }
});

test("Given CRD rule journals, then fabricated summaries and corrupted Unicode are excluded", () => {
  const combat = JSON.parse(fs.readFileSync(path.join(root, "packs/rules-en/_source/a1b2c3d4e5f6070c.json"), "utf8"));
  const content = combat.pages[0].text.content;
  assert.ok(!content.includes("Combat uses attack rolls and defense rolls."));
  assert.ok(!content.includes("Armor indicates how much less damage a character takes"));
  for (const family of ["equipment", "abilities"]) {
    const directory = path.join(root, `packs/${family}-en/_source`);
    for (const file of fs.readdirSync(directory, { recursive: true }).filter(file => file.endsWith(".json"))) {
      const record = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
      assert.ok(!record.system?.description?.includes("\ufffe"), `${family}/${file}`);
    }
  }
});

test("Given CRD named definitions, then extraction preserves their names, boundaries and action timing", () => {
  const readAbility = id => JSON.parse(fs.readFileSync(path.join(root, `packs/abilities-en/_source/${id}.json`), "utf8"));
  const grandiose = readAbility("982bef99b0e3ed87");
  assert.equal(grandiose.name, "Grandiose Illusion", "CRD — Casts Illusions — Tier 6");
  assert.equal(grandiose.system.action, "lastAction");
  assert.ok(plainText(grandiose.system.description).endsWith("Last action to initiate."));
  assert.equal(readAbility("0cd8da202037407c").name, "Supreme Retribution", "CRD — Quells Evil — Tier 6");
  for (const [id, neighbour] of [
    ["05ddc37dca28a8c9", "Hand to Eye"], ["1f9d46bc2d619c20", "Noble Defender"],
    ["5069da728f6ff127", "Bone Lore"], ["cc08928a91d47925", "Successive Attack"]
  ]) assert.ok(!readAbility(id).system.description.includes(`${neighbour} (`), neighbour);
  assert.ok(readAbility("c5c512356bd9a223").system.description.includes("Only one +1 Edge can be gained at a time"),
    "CRD — Consorts With the Dead — Blood Sorcery restriction");
});

test("Given the CRD Noble Warrior package, then its three tier-one Abilities are separate references", () => {
  const type = JSON.parse(fs.readFileSync(path.join(root, "packs/types-en/_source/noble-warrior.json"), "utf8"));
  // Filenames preserve authoring provenance and need not equal canonical _ids.
  const directory = path.join(root, "packs/abilities-en/_source");
  const abilities = new Map(fs.readdirSync(directory).filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")))
    .map(document => [document._id, document]));
  const names = type.system.abilities.map(uuid => {
    const ability = abilities.get(uuid.split(".").at(-1));
    assert.ok(ability, "Noble Warrior Ability reference must resolve");
    return ability.name;
  });
  assert.deepEqual(names, ["Expert Combatant", "Noble Defender", "Noble Sacrifice"]);
});

test("Given the CRD Sports car equipment row, then it is equipment and excludes the next reference sections", () => {
  const car = JSON.parse(fs.readFileSync(path.join(root, "packs/equipment-en/_source/real-world/119.json"), "utf8"));
  assert.equal(car.type, "equipment");
  assert.equal(plainText(car.system.description), "Fast and flashy, seats two or three");
  assert.ok(!car.system.properties?.some(value => value.includes("Currency Equivalences")));
});

test("Given CRD species packages, then Charm choices and conditional restrictions stay visible", () => {
  for (const name of ["naron", "prota"]) {
    const record = JSON.parse(fs.readFileSync(path.join(root, `packs/descriptors-en/_source/species/${name}.json`), "utf8"));
    assert.ok(record.system.skillOptions.includes("Charm"), `CRD — Science Fiction Species — ${record.name}`);
    assert.ok(!record.system.skillOptions.includes("Persuasion"));
  }
  const dragonfolk = JSON.parse(fs.readFileSync(path.join(root, "packs/descriptors-en/_source/species/dragonfolk.json"), "utf8"));
  assert.ok(plainText(dragonfolk.system.description).includes("except against other dragonfolk and dragons"));
});

test("Given CRD cost headers, then zero-plus costs retain their Pool and Advanced Command starts at four", () => {
  for (const [id, stat, amount] of [
    ["4305ab2d2604ff9f", "intellect", 0], ["6c291bca38a61166", "intellect", 0],
    ["78a661a918988465", "might", 0], ["90ed0f190cccb07b", "intellect", 0],
    ["a179c2e322ef48de", "intellect", 0], ["b80f0e1b550d811a", "speed", 0],
    ["b8d549ad2bcc6a2b", "intellect", 0], ["d4ac515041ad9e9b", "intellect", 0],
    ["c5c9be9fb769a9ca", "intellect", 4]
  ]) {
    const ability = JSON.parse(fs.readFileSync(path.join(root, `packs/abilities-en/_source/${id}.json`), "utf8"));
    assert.equal(ability.system.cost.stat, stat, ability.name);
    assert.equal(ability.system.cost.amount, amount, ability.name);
  }
});
