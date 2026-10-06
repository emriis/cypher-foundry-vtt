import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function readFocus(slug) {
  const file = path.join(root, "packs", "foci-en", "_source", slug + ".json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readAbilities() {
  const directory = path.join(root, "packs", "abilities-en", "_source");
  return new Map(
    fs.readdirSync(directory)
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const document = JSON.parse(
          fs.readFileSync(path.join(directory, file), "utf8")
        );
        return [document._id, document];
      })
  );
}

function abilityId(reference) {
  return reference.match(/Item\.([A-Za-z0-9]{16})$/)?.[1] ?? null;
}

function abilityKeysByTier(focus, abilities) {
  const result = new Map();

  for (const reference of focus.system.abilities ?? []) {
    const id = abilityId(reference);
    const ability = abilities.get(id);
    assert.ok(ability, focus.name + ": missing Ability " + id);

    const tier = ability.system?.tier;
    assert.ok(Number.isInteger(tier), focus.name + ": missing Ability tier");

    if (!result.has(tier)) result.set(tier, []);
    result.get(tier).push(ability.system?.key);
  }

  return new Map(
    [...result].map(([tier, keys]) => [tier, [...keys].sort()])
  );
}

const fixtures = [
  {
    slug: "changes-shape",
    description:
      "<p>You can transform into various animals, gaining their natural " +
      "abilities as if you were born with them.</p>",
    counts: { 1: 3, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3 },
    tierOne: ["animal-shape", "keen-eye", "scent-transformation"]
  },
  {
    slug: "doesnt-do-much",
    description:
      "<p>You're a slacker, but you know a little about a lot of things.</p>",
    counts: { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1 },
    tierOne: [
      "joy-in-small-things",
      "life-lessons",
      "picking-up-the-slack"
    ]
  }
];

test("CRD Focus fidelity fixtures preserve representative source structure", () => {
  const abilities = readAbilities();

  for (const fixture of fixtures) {
    const focus = readFocus(fixture.slug);

    assert.equal(focus.system.description, fixture.description);
    assert.deepEqual(
      Object.fromEntries(
        [...abilityKeysByTier(focus, abilities)].map(([tier, keys]) => [
          tier,
          keys.length
        ])
      ),
      fixture.counts
    );

    assert.deepEqual(
      abilityKeysByTier(focus, abilities).get(1),
      [...fixture.tierOne].sort()
    );
  }
});
