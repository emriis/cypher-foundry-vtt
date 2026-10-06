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
    slug: "abides-in-stone",
    description:
      "<p>Your flesh is made of hard mineral, making you a hulking, " +
      "difficult-to-harm humanoid.</p>",
    abilityCount: 15,
    edgeCount: 18
  },
  {
    slug: "blazes-with-fire",
    description:
      "<p>You can sheathe your body in flames, which protect you and harm " +
      "your foes.</p>",
    abilityCount: 14,
    edgeCount: 21
  },
  {
    slug: "carries-a-gun",
    description:
      "<p>You carry a firearm (whether a conventional gunpowder pistol or " +
      "some kind of blaster or energy weapon) and you know how to use it " +
      "in a fight.</p>",
    abilityCount: 14,
    edgeCount: 28
  },
  {
    slug: "casts-spells",
    description:
      "<p>You have a book of various spells and can change which ones you " +
      "have ready to cast each day—blasts of energy, summoning monsters, " +
      "magical flight, teleportation, and copying cyphers can all be part " +
      "of your repertoire.</p>",
    abilityCount: 17,
    edgeCount: 42
  },
  {
    slug: "fights-dirty",
    description:
      "<p>You'll do anything to win a fight: bite, scratch, kick, trick, " +
      "and worse.</p>",
    abilityCount: 14,
    edgeCount: 14
  },
  {
    slug: "talks-to-machines",
    description:
      "<p>You use your brain like a computer, interfacing “wirelessly” " +
      "with any electronic device. You can control and influence them in " +
      "ways that others can't.</p>",
    abilityCount: 13,
    edgeCount: 11
  },
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
    assert.equal(
      focus.system.abilities.length,
      fixture.abilityCount
    );
    assert.equal(
      focus.system.flowchart.edges.length,
      fixture.edgeCount
    );
    if (fixture.counts) assert.deepEqual(
      Object.fromEntries(
        [...abilityKeysByTier(focus, abilities)].map(([tier, keys]) => [
          tier,
          keys.length
        ])
      ),
      fixture.counts
    );

    if (fixture.tierOne) assert.deepEqual(
      abilityKeysByTier(focus, abilities).get(1),
      [...fixture.tierOne].sort()
    );
  }
});
