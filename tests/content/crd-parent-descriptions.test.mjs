// Source-derived parent context complements referenced Ability Items; it must
// retain character creation instructions without duplicating their definitions.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";

const root = path.resolve(import.meta.dirname, "../..");

function readSources(family) {
  const directory = path.join(root, "packs", `${family}-en`, "_source");
  return fs.readdirSync(directory).filter(file => file.endsWith(".json"))
    .map(file => ({ file, document: JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")) }))
    .filter(entry => !entry.document._key?.startsWith("!folders!"));
}

test("Given CRD Foci, then every parent retains its Genre themes and GM intrusions before the referenced Abilities", () => {
  const foci = readSources("foci");
  assert.equal(foci.length, 42);
  for (const { file, document } of foci) {
    const text = plainText(document.system.description);
    assert.match(text, /Genre themes:/, file);
    assert.match(text, /GM intrusions:/, file);
    assert.ok(document.system.abilities.length > 0, file);
  }
  const stone = foci.find(entry => entry.file === "abides-in-stone.json").document;
  assert.ok(plainText(stone.system.description).includes("A walking statue can terrify common folk."));
  assert.ok(!plainText(stone.system.description).includes("Intimidating Presence:"),
    "Playable Ability definitions remain in the separately referenced Items");
});

test("Given CRD Types, then every parent retains background, initial benefits and source equipment instructions", () => {
  const types = readSources("types");
  assert.equal(types.length, 55);
  for (const { file, document } of types) {
    const text = plainText(document.system.description);
    assert.match(text, /Background(?: Options)?/, file);
    assert.ok(text.includes("You gain all of the following benefits:"), file);
    if (document.system.genre !== "Superheroes") {
      assert.match(text, /Equipment Bundle/, file);
      assert.ok(text.includes("assemble your own starting equipment."), file);
    }
  }
  const barbarian = types.find(entry => entry.file === "barbarian.json").document;
  assert.ok(plainText(barbarian.system.description).includes("At tier 3 and tier 6, choose an ability from the Fantasy Genre Abilities list"));
  assert.ok(!plainText(barbarian.system.description).includes("Frenzy (1+ Intellect):"));
});

test("Given genre aliases in the CRD, then their parent context retains the explicit cross-genre relationship", () => {
  const types = new Map(readSources("types").map(entry => [entry.file, entry.document]));
  const aliases = {
    "archer-epic-fantasy.json": "The stats for an epic fantasy Archer are the same as those for an Archer making their way through a swords & sorcery setting.",
    "barbarian-swords-sorcery.json": "The stats for a swords & sorcery Barbarian are the same as those for a dungeon fantasy Barbarian.",
    "diplomat-space-opera.json": "The stats for a space opera Diplomat are the same as those for a Diplomat in a hard science fiction setting.",
    "medic-space-opera.json": "The stats for a space opera Medic are the same as those for a Medic in a hard science fiction setting.",
    "noble-hard-science-fiction.json": "The stats for a hard science fiction Noble are the same as those for a Noble in a space opera.",
    "soldier-space-opera.json": "The stats for a space opera Soldier are the same as those for a Soldier in a hard science fiction setting."
  };
  for (const [file, source] of Object.entries(aliases)) {
    assert.ok(plainText(types.get(file).system.description).includes(source), file);
  }
});

test("Given the Warrior Type, then its introduction belongs to Warrior rather than Noble Warrior", () => {
  const warrior = readSources("types").find(entry => entry.file === "warrior.json").document;
  assert.ok(plainText(warrior.system.description).startsWith("Strength. That’s what you have."));
  assert.ok(!plainText(warrior.system.description).includes("A life well-lived, you believe"));
});

test("Given Audacious Blast, then its selectable attack consequences and action timing remain in the parent definition", () => {
  const directory = path.join(root, "packs", "abilities-en", "_source");
  const documents = fs.readdirSync(directory).filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")));
  const ability = documents.find(document => document.system?.key === "audacious-blast");
  const text = plainText(ability.system.description);
  assert.ok(text.includes("Disarming Shot: The attack inflicts 1 less damage"));
  assert.ok(text.includes("To retrieve the object, the foe must use an action."));
  assert.ok(text.includes("Piercing Accuracy: The foe takes +2 damage."));
  assert.ok(text.endsWith("Action."));
  assert.ok(!text.includes("Audacious Blast GM intrusions:"),
    "The neighbouring GM callout is a separate editorial passage");
  assert.equal(ability.system.action, "action");
});

test("Given the supplied Howls at the Moon diagram, then Wings and every explicitly directed prerequisite arrow survive extraction", () => {
  const focus = readSources("foci").find(entry => entry.file === "howls-at-the-moon.json").document;
  const directory = path.join(root, "packs", "abilities-en", "_source");
  const abilities = new Map(fs.readdirSync(directory).filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")))
    .map(document => [document._id, document]));
  const byKey = new Map(focus.system.abilities.map(reference => {
    const ability = abilities.get(reference.split(".").at(-1));
    return [ability.system.key, ability];
  }));
  const wings = byKey.get("wings");
  assert.ok(wings, "CRD paragraph 4390 is its own tier-four Ability");
  assert.equal(wings.name, "Wings");
  assert.equal(wings.system.tier, 4);
  assert.deepEqual(wings.system.cost, { stat: "might", amount: 4, options: [] });
  assert.ok(plainText(wings.system.description).includes("Action when in your normal form; enabler when using Beast Form."));

  // Independently inspected CRD image anchored at paragraph 4368. Both arrowheads
  // on the two tier-one horizontal links are explicit, not inferred reciprocity.
  const expected = [
    ["call-upon-the-beast", "beast-form"], ["beast-form", "call-upon-the-beast"],
    ["keen-eye", "beast-form"], ["beast-form", "keen-eye"],
    ["beast-form", "scales"], ["beast-form", "controlled-change"],
    ["beast-form", "beast-senses"], ["beast-form", "talons-or-claws"],
    ["scales", "wounded-fury"], ["scales", "bigger-beast-form"],
    ["controlled-change", "bigger-beast-form"], ["beast-senses", "sleeker-beast-form"],
    ["talons-or-claws", "sleeker-beast-form"], ["wounded-fury", "poison-bite"],
    ["bigger-beast-form", "poison-bite"], ["bigger-beast-form", "greater-controlled-change"],
    ["bigger-beast-form", "beast-healing"], ["sleeker-beast-form", "greater-controlled-change"],
    ["sleeker-beast-form", "beast-healing"], ["sleeker-beast-form", "wings"],
    ["poison-bite", "enhanced-beast-form"], ["greater-controlled-change", "enhanced-beast-form"],
    ["beast-healing", "brute-squad"], ["wings", "brute-squad"],
    ["enhanced-beast-form", "constrict"], ["enhanced-beast-form", "perfect-control"],
    ["brute-squad", "perfect-control"], ["brute-squad", "lethal-capability"]
  ].map(edge => edge.join("->")).sort();
  const actual = focus.system.flowchart.edges
    .map(edge => [abilities.get(edge.from).system.key, abilities.get(edge.to).system.key].join("->")).sort();
  assert.deepEqual(actual, expected);
});

test("Given embedded CRD attack options and ritual children, then their descriptions retain their own complete source boundaries", () => {
  const directory = path.join(root, "packs", "abilities-en", "_source");
  const byKey = new Map(fs.readdirSync(directory).filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")))
    .map(document => [document.system?.key, document]));
  const flamboyant = byKey.get("flamboyant-swordplay");
  assert.ok(plainText(flamboyant.system.description).includes("Daring Lunge: The foe takes +2 damage."));
  assert.ok(plainText(flamboyant.system.description).includes("Disarming Agility: The attack inflicts 1 less damage"));
  assert.ok(plainText(flamboyant.system.description).endsWith("Action."));
  assert.equal(flamboyant.system.action, "action");
  const skull = byKey.get("split-skull");
  assert.ok(plainText(skull.system.description).includes("Brute Force: The foe takes +2 damage."));
  assert.ok(plainText(skull.system.description).includes("Head Trauma: The attack inflicts 1 less damage"));
  assert.ok(plainText(skull.system.description).endsWith("Action."));
  assert.equal(skull.system.action, "action");
  const gut = byKey.get("gut-ripper");
  assert.ok(plainText(gut.system.description).includes("Deep Slice: The foe takes +2 damage."));
  assert.ok(plainText(gut.system.description).includes("Let Them Bleed: The wound bleeds; on your next turn, the foe takes 2 damage that ignores armor."));
  assert.ok(plainText(gut.system.description).endsWith("Action."));
  assert.equal(gut.system.action, "action");
  const swing = byKey.get("swing-through");
  assert.ok(plainText(swing.system.description).includes("Eat Steel: The foe takes +2 damage."));
  assert.ok(plainText(swing.system.description).includes("Slice and Step: You reposition your foe or yourself an immediate distance away"));
  assert.ok(plainText(swing.system.description).endsWith("Action."));
  assert.equal(swing.system.action, "action");
  const suggestion = byKey.get("sorcerous-suggestion");
  assert.ok(plainText(suggestion.system.description).endsWith("do nothing. Action."));
  assert.ok(!plainText(suggestion.system.description).includes("Ten minutes to activate"),
    "The ritual timing belongs to Open Inner Eye, not its action-taking child");
  assert.ok(!plainText(suggestion.system.description).includes("Most types give you three abilities"));
  assert.equal(suggestion.system.action, "action");
  const idol = byKey.get("idol");
  const idolText = plainText(idol.system.description);
  assert.ok(idolText.includes("Bestial Fury: The supplicant is infused"));
  assert.ok(idolText.includes("taking the better result"));
  assert.ok(idolText.includes("effectively one level higher and takes 6 damage"));
  assert.ok(idolText.includes("Healing: The severity of one of the supplicant’s wounds is reduced by one step."));
  assert.ok(idolText.includes("Spiritual Cleanse: The supplicant is freed from one curse"));
  assert.ok(idolText.includes("Effort: You can carry the idol with you."));
  assert.ok(idolText.endsWith("Ten minutes to initiate."));
});
