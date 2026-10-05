import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

const EXPECTED_FOCI = [
  ["abides-in-stone", "Abides in Stone"],
  ["blazes-with-fire", "Blazes With Fire"],
  ["builds-allies", "Builds Allies"],
  ["carries-a-gun", "Carries a Gun"],
  ["casts-spells", "Casts Spells"],
  ["changes-shape", "Changes Shape"],
  ["commands-mental-powers", "Commands Mental Powers"],
  ["consorts-with-the-dead", "Consorts With the Dead"],
  ["controls-beasts", "Controls Beasts"],
  ["crafts-illusions", "Crafts Illusions"],
  ["doesnt-do-much", "Doesn't Do Much"],
  ["employs-magnetism", "Employs Magnetism"],
  ["entertains", "Entertains"],
  ["explores", "Explores"],
  ["fights-dirty", "Fights Dirty"],
  ["fights-unarmed", "Fights Unarmed"],
  ["fights-with-panache", "Fights With Panache"],
  ["fuses-flesh-and-steel", "Fuses Flesh and Steel"],
  ["fuses-mind-and-machine", "Fuses Mind and Machine"],
  ["grows-to-towering-heights", "Grows to Towering Heights"],
  ["howls-at-the-moon", "Howls at the Moon"],
  ["hunts", "Hunts"],
  ["infiltrates", "Infiltrates"],
  ["leads", "Leads"],
  ["masters-telekinesis", "Masters Telekinesis"],
  ["masters-weaponry", "Masters Weaponry"],
  ["moves-like-the-wind", "Moves Like the Wind"],
  ["never-says-die", "Never Says Die"],
  ["performs-feats-of-strength", "Performs Feats of Strength"],
  ["quells-evil", "Quells Evil"],
  ["reveres-a-supernatural-force", "Reveres a Supernatural Force"],
  ["rides-the-lightning", "Rides the Lightning"],
  ["sneaks-through-the-shadows", "Sneaks Through the Shadows"],
  ["solves-mysteries", "Solves Mysteries"],
  ["speaks-for-the-land", "Speaks for the Land"],
  ["stands-like-a-bastion", "Stands Like A Bastion"],
  ["strikes-with-mystic-might", "Strikes With Mystic Might"],
  ["talks-to-machines", "Talks to Machines"],
  ["tends-to-the-wounded", "Tends to the Wounded"],
  ["walks-through-walls", "Walks Through Walls"],
  ["wears-a-sheen-of-ice", "Wears a Sheen of Ice"],
  ["works-for-a-living", "Works for a Living"]
];

function readPackSources(family, language) {
  const directory = path.join(
    root,
    "packs",
    `${family}-${language}`,
    "_source"
  );

  return fs.readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(
      fs.readFileSync(path.join(directory, file), "utf8")
    ))
    .filter(document => !document._key?.startsWith("!folders!"));
}

function abilityId(reference) {
  if (typeof reference !== "string") return null;
  return reference.match(/Item\.([A-Za-z0-9]{16})$/)?.[1] ?? null;
}

function assertFlowchart(document, abilities, label) {
  const abilityIds = new Set(
    document.system.abilities.map(abilityId)
  );
  const edges = document.system.flowchart?.edges ?? [];
  const edgeKeys = new Set();
  const incident = new Set();

  assert.ok(edges.length > 0, label);

  for (const edge of edges) {
    assert.ok(abilityIds.has(edge.from), `${label}: unknown edge source ${edge.from}`);
    assert.ok(abilityIds.has(edge.to), `${label}: unknown edge target ${edge.to}`);
    assert.notEqual(edge.from, edge.to, label);

    const key = `${edge.from}->${edge.to}`;
    assert.equal(edgeKeys.has(key), false, `${label}: duplicate edge ${key}`);
    edgeKeys.add(key);
    incident.add(edge.from);
    incident.add(edge.to);

    const fromTier = abilities.get(edge.from)?.system?.tier;
    const toTier = abilities.get(edge.to)?.system?.tier;
    assert.ok(Number.isInteger(fromTier), `${label}: missing source tier`);
    assert.ok(Number.isInteger(toTier), `${label}: missing target tier`);
    assert.ok(
      Math.abs(toTier - fromTier) <= 1,
      `${label}: edge skips tiers (${fromTier} -> ${toTier})`
    );
  }

  assert.deepEqual(
    [...incident].sort(),
    [...abilityIds].sort(),
    `${label}: every focus ability must participate in the flowchart`
  );

  const adjacency = new Map(
    [...abilityIds].map(id => [id, new Set()])
  );
  for (const edge of edges) {
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }

  const visited = new Set();
  const queue = [document.system.abilities.map(abilityId)[0]];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  assert.deepEqual(
    [...visited].sort(),
    [...abilityIds].sort(),
    `${label}: flowchart must be connected`
  );
}

for (const [language] of [["en"], ["fr"]]) {
  test(`CRD Focus inventory contains exactly the authoritative ${language.toUpperCase()} set`, () => {
    const sources = readPackSources("foci", language);
    const byLogicalId = new Map(
      sources.map(document => [
        document.flags?.cypherFoundry?.crd?.logicalId,
        document
      ])
    );

    assert.equal(byLogicalId.size, EXPECTED_FOCI.length);

    for (const [slug, name] of EXPECTED_FOCI) {
      const logicalId = `focus.${slug}`;
      const document = byLogicalId.get(logicalId);
      assert.ok(document, logicalId);
      assert.equal(document.name, name);
    }
  });
}

test("CRD Focus references resolve to standalone Ability sources", () => {
  const foci = readPackSources("foci", "en");
  const abilities = new Map(
    readPackSources("abilities", "en").map(document => [
      document._id,
      document
    ])
  );

  for (const focus of foci) {
    const references = focus.system.abilities ?? [];
    assert.ok(references.length > 0, focus.name);

    const ids = references.map(abilityId);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${focus.name}: duplicate Ability reference`
    );

    for (const id of ids) {
      assert.ok(id, `${focus.name}: malformed Ability reference`);
      assert.ok(
        abilities.has(id),
        `${focus.name}: missing Ability source ${id}`
      );
    }

    assertFlowchart(focus, abilities, focus.name);
  }
});

test("CRD Focus English and French graphs preserve logical identity", () => {
  const englishFoci = new Map(
    readPackSources("foci", "en").map(document => [
      document.flags.cypherFoundry.crd.logicalId,
      document
    ])
  );
  const frenchFoci = new Map(
    readPackSources("foci", "fr").map(document => [
      document.flags.cypherFoundry.crd.sourceLogicalId,
      document
    ])
  );
  const englishAbilities = new Map(
    readPackSources("abilities", "en").map(document => [
      document._id,
      document
    ])
  );
  const frenchAbilities = new Map(
    readPackSources("abilities", "fr").map(document => [
      document._id,
      document
    ])
  );

  const normalizeGraph = (focus, abilities) => {
    const logicalIds = new Map(
      focus.system.abilities.map(abilityId).map(id => [
        id,
        abilities.get(id)?.flags?.cypherFoundry?.crd?.logicalId
      ])
    );

    return {
      abilities: [...logicalIds.values()].sort(),
      edges: (focus.system.flowchart?.edges ?? [])
        .map(edge => [
          logicalIds.get(edge.from),
          logicalIds.get(edge.to)
        ])
        .sort((left, right) =>
          `${left[0]}->${left[1]}`.localeCompare(
            `${right[0]}->${right[1]}`
          )
        )
    };
  };

  for (const [logicalId, enFocus] of englishFoci) {
    const frFocus = frenchFoci.get(logicalId);
    assert.ok(frFocus, logicalId);

    assert.deepEqual(
      normalizeGraph(enFocus, englishAbilities),
      normalizeGraph(frFocus, frenchAbilities),
      `${logicalId}: EN/FR focus graph mismatch`
    );
  }
});
