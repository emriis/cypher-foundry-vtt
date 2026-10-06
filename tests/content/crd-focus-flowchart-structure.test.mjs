import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function readSources(family, language) {
  const directory = path.join(
    root,
    "packs",
    family + "-" + language,
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

function validateFlowchart(focus, abilities) {
  const label = focus.name;
  const referencedIds = new Set(
    (focus.system.abilities ?? []).map(abilityId)
  );
  const nodes = new Map();

  for (const id of referencedIds) {
    const ability = abilities.get(id);
    assert.ok(ability, label + ": missing Ability source " + id);

    const tier = ability.system?.tier;
    assert.ok(
      Number.isInteger(tier),
      label + ": missing tier for Ability " + id
    );

    nodes.set(id, { tier, key: ability.system?.key ?? id });
  }

  const edges = focus.system.flowchart?.edges ?? [];
  assert.ok(edges.length > 0, label + ": flowchart has no edges");

  const edgeKeys = new Set();
  const incoming = new Set();
  const adjacency = new Map();

  for (const edge of edges) {
    assert.ok(
      nodes.has(edge.from),
      label + ": unknown edge source " + edge.from
    );
    assert.ok(
      nodes.has(edge.to),
      label + ": unknown edge target " + edge.to
    );
    assert.notEqual(
      edge.from,
      edge.to,
      label + ": self-referential edge " + edge.from
    );

    const edgeKey = edge.from + "->" + edge.to;
    assert.equal(
      edgeKeys.has(edgeKey),
      false,
      label + ": duplicate edge " + edgeKey
    );
    edgeKeys.add(edgeKey);

    const fromTier = nodes.get(edge.from).tier;
    const toTier = nodes.get(edge.to).tier;

    assert.ok(
      toTier >= fromTier,
      label + ": edge " + nodes.get(edge.from).key + " -> " +
        nodes.get(edge.to).key + " moves backward in tiers (" +
        fromTier + " -> " + toTier + ")"
    );

    incoming.add(edge.to);
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }

  for (const [id, node] of nodes) {
    if (node.tier > 1) {
      assert.ok(
        incoming.has(id),
        label + ": non-tier-1 Ability " + node.key +
          " has no prerequisite edge"
      );
    }
  }

  const tierOne = [...nodes]
    .filter(([, node]) => node.tier === 1)
    .map(([id]) => id);

  assert.ok(
    tierOne.length > 0,
    label + ": flowchart has no tier-1 Ability"
  );

  const reachable = new Set(tierOne);
  const queue = [...tierOne];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of adjacency.get(current) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  for (const [id, node] of nodes) {
    if (node.tier > 1) {
      assert.ok(
        reachable.has(id),
        label + ": Ability " + node.key +
          " is not reachable from a tier-1 Ability"
      );
    }
  }
}

for (const language of ["en", "fr"]) {
  test(
    "CRD Focus " + language.toUpperCase() +
      " flowcharts preserve tier progression",
    () => {
      const foci = readSources("foci", language);
      const abilities = new Map(
        readSources("abilities", language).map(document => [
          document._id,
          document
        ])
      );

      const failures = [];

      for (const focus of foci) {
        try {
          validateFlowchart(focus, abilities);
        } catch (error) {
          failures.push(focus.name + ": " + error.message);
        }
      }

      assert.deepEqual(
        failures,
        [],
        "Focus flowchart structure failures (" +
          language.toUpperCase() + ")"
      );
    }
  );
}
