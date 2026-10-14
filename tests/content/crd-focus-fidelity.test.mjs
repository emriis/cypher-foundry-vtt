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

// Independently transcribed complete CRD parent sections, including callouts and
// Genre/GM context; Ability definitions remain covered by references and tiers.
const fixtures = [
  {
    slug: "abides-in-stone",
    description:
      "<p>Your flesh is made of hard mineral, making you a hulking, difficult-to-harm humanoid.</p>\n<ul>\n<li>Genre themes: golem (fantasy), crystal alien (science fiction), rock monster (superhero)</li>\n<li>GM intrusions: Creatures of stone sometimes forget their own strength or weight. A walking statue can terrify common folk.</li>\n</ul>",
    abilityCount: 15,
    edgeCount: 18
  },
  {
    slug: "blazes-with-fire",
    description:
      "<p>You can sheathe your body in flames, which protect you and harm your foes.</p>\n<ul>\n<li>Genre themes: fire wizard (fantasy), lava world alien (science fiction), fiery super (superhero)</li>\n<li>GM intrusions: Fire burns flammable material. Fire spreads out of control. Primitive creatures fear fire and often attack what they fear.</li>\n</ul>",
    abilityCount: 14,
    edgeCount: 21
  },
  {
    slug: "carries-a-gun",
    description:
      "<p>You carry a firearm (whether a conventional gunpowder pistol or some kind of blaster or energy weapon) and you know how to use it in a fight.</p>\n<ul>\n<li>Genre themes: musketeer (fantasy), soldier (historical, real world, science fiction)</li>\n<li>GM intrusions: Weapons misfire or jam; the attack fails and the action is lost, plus an additional action is needed to fix the problem. An attack strikes sensitive equipment or an unintended target.</li>\n<li>Additional equipment: You have a medium or small firearm.</li>\n</ul>",
    abilityCount: 14,
    edgeCount: 28
  },
  {
    slug: "casts-spells",
    description:
      "<p>You have a book of various spells and can change which ones you have ready to cast each day—blasts of energy, summoning monsters, magical flight, teleportation, and copying cyphers can all be part of your repertoire.</p>\n<p>Character abilities from the Casts Spells focus are magical spells or rituals. Your character has to use specific magic words and gestures to activate them, and they may require tiny amounts of strange ingredients like spider eyes and powdered gemstones. These are just story and flavor requirements; in terms of game mechanics, these abilities work just like abilities from other foci and from various types.</p>\n<ul>\n<li>Genre themes: sorcerer or wizard (fantasy), magician (real world with magic and/or horror), master of the mystic arts (superhero)</li>\n<li>GM intrusions: A spell goes wrong. A summoned creature turns on the caster. A rival spellcaster is drawn to the magic use.</li>\n</ul>",
    abilityCount: 17,
    edgeCount: 41
  },
  {
    slug: "fights-dirty",
    description:
      "<p>You’ll do anything to win a fight: bite, scratch, kick, trick, and worse.</p>\n<ul>\n<li>Genre themes: troublemaker, loner (any genre)</li>\n<li>GM intrusions: People look poorly upon those who cheat or fight without honor. Sometimes a dirty trick backfires.</li>\n</ul>",
    abilityCount: 14,
    edgeCount: 14
  },
  {
    slug: "talks-to-machines",
    description:
      "<p>You use your brain like a computer, interfacing “wirelessly” with any electronic device. You can control and influence them in ways that others can’t.</p>\n<ul>\n<li>Genre themes: golem whisperer (fantasy), coder (real world), cyber mind (science fiction, superhero)</li>\n<li>GM intrusions: The machine malfunctions or acts unpredictably.</li>\n</ul>\n<p>If you Talk to Machines, you can use your abilities at the indicated range, use them within range of a device you can remotely transmit data from, and (regardless of physical distance) affect networked machines that are on the same network you’re accessing.</p>",
    abilityCount: 13,
    edgeCount: 11
  },
  {
    slug: "changes-shape",
    description:
      "<p>You can transform into various animals, gaining their natural abilities as if you were born with them.</p>\n<ul>\n<li>Genre themes: animal druid (fantasy), shapeshifter (science fiction, superhero)</li>\n<li>GM intrusions: Something triggers an involuntary transformation. An NPC is frightened by or aggressive toward the shapeshifter. The transformation takes longer than expected.</li>\n</ul>",
    abilityCount: 14,
    edgeCount: 25,
    counts: { 1: 3, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3 },
    tierOne: ["animal-shape", "keen-eye", "scent-transformation"]
  },
  {
    slug: "doesnt-do-much",
    description:
      "<p>You’re a slacker, but you know a little about a lot of things.</p>\n<ul>\n<li>Genre themes: Free spirit, itinerant (any genre)</li>\n<li>GM intrusions: New situations are confounding and stressful. Past actions (or inactions) come back to haunt the character.\\</li>\n</ul>",
    abilityCount: 11,
    edgeCount: 12,
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
