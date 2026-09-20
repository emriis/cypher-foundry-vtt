import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

for (const language of ["en", "fr"]) {
  test(`type sources contain all generated ${language} entries`, () => {
    const directory = path.join(root, "packs", `types-${language}`, "_source");
    const files = fs.readdirSync(directory).filter(file => file.endsWith(".json"));

    assert.equal(files.length, 56);
    for (const file of files) {
      const item = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
      assert.equal(item.type, "type");
      assert.match(item._key, /^!items![A-Za-z0-9]{16}$/);
      assert.ok(item.name);
      assert.ok(item.system.genre);
      assert.ok(item.system.subgenre);
      assert.ok(item.system.description);
      assert.ok(item.system.statOptions.length > 0);
    }
  });

  test(`generated ${language} Type mechanics stay tied to their source section`, () => {
    const directory = path.join(root, "packs", `types-${language}`, "_source");
    const barbarian = JSON.parse(fs.readFileSync(path.join(directory, language === "en" ? "barbarian.json" : "barbarian.json"), "utf8"));
    assert.deepEqual(barbarian.system.poolBonuses, { might: 3, speed: 1, intellect: 0 });
    assert.deepEqual(barbarian.system.woundBonuses, { minor: 3, moderate: 1, major: 0 });
    assert.equal(barbarian.system.edgeChoice, 1);
    assert.equal(barbarian.system.freeWeapons, true);
    assert.equal(barbarian.system.freeArmor, true);

    const crimefighter = JSON.parse(fs.readFileSync(path.join(directory, "crimefighter-rank-1.json"), "utf8"));
    assert.deepEqual(crimefighter.system.poolBonuses, { might: 2, speed: 3, intellect: 5 });
    assert.deepEqual(crimefighter.system.woundBonuses, { minor: 3, moderate: 1, major: 0 });
    assert.equal(crimefighter.system.abilities.length, 3);
  });

  test(`generated ${language} Type abilities have valid item data`, () => {
    const directory = path.join(root, "packs", `types-${language}`, "_source");
    for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".json"))) {
      const item = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
      const abilityNames = new Set();
      for (const ability of item.system.abilities) {
        assert.ok(ability.name);
        const abilityKey = `${ability.name}|${ability.tier}|${ability.description}`;
        assert.equal(abilityNames.has(abilityKey), false);
        abilityNames.add(abilityKey);
        assert.ok(ability.tier >= 1 && ability.tier <= 6);
        assert.ok(["might", "speed", "intellect", "none"].includes(ability.cost.stat));
        assert.ok(Number.isInteger(ability.cost.amount) && ability.cost.amount >= 0);
        assert.ok(ability.description);
      }
    }
  });
}