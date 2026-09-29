import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

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