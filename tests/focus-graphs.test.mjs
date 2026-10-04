// Validates Focus flowcharts after abilities become standalone documents.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function readSources(language) {
  const directory = path.join(root, "packs", `foci-${language}`, "_source");
  return fs.readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(
      fs.readFileSync(path.join(directory, file), "utf8")
    ));
}

function abilityId(uuid) {
  return uuid.split(".").at(-1);
}

for (const language of ["en", "fr"]) {
  test(`${language} Focus flowcharts reference only abilities in the Focus`, () => {
    for (const focus of readSources(language)) {
      if (focus._key.startsWith("!folders!")) continue;

      const abilities = new Set(focus.system.abilities);
      const edges = focus.system.flowchart?.edges ?? [];

      assert.equal(
        focus.system.abilities.length,
        abilities.size,
        `${focus.name} contains duplicate ability references`
      );

      for (const edge of edges) {
        assert.ok(abilities.has(edge.from), `${focus.name}: missing edge source`);
        assert.ok(abilities.has(edge.to), `${focus.name}: missing edge target`);
      }
    }
  });
}

test("French and English Foci preserve ability order and graph topology", () => {
  const en = new Map(readSources("en").map(document => [document.name, document]));
  const fr = new Map(readSources("fr").map(document => [document.name, document]));

  for (const [name, english] of en) {
    const french = fr.get(name);
    if (!french) continue;

    assert.equal(
      english.system.abilities.length,
      french.system.abilities.length,
      `${name}: ability count`
    );

    const enEdges = english.system.flowchart?.edges ?? [];
    const frEdges = french.system.flowchart?.edges ?? [];

    assert.equal(enEdges.length, frEdges.length, `${name}: edge count`);

    const normalize = edge => [abilityId(edge.from), abilityId(edge.to)].sort().join(":");
    assert.deepEqual(
      frEdges.map(normalize).sort(),
      enEdges.map(normalize).sort(),
      `${name}: graph topology`
    );
  }
});
