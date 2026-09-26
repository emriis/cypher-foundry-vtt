import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

for (const language of ["en", "fr"]) {
  test(`type sources contain all generated ${language} entries`, () => {
    const directory = path.join(root, "packs", `types-${language}`, "_source");
    const files = fs.readdirSync(directory).filter(file => file.endsWith(".json"));
    const sources = files.map(file => ({
      file,
      item: JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))
    }));
    const entries = sources.map(source => source.item);
    const items = entries.filter(item => item._key.startsWith("!items!"));
    const folders = entries.filter(item => item._key.startsWith("!folders!"));
    const slugsById = new Map(sources
      .filter(source => source.item._key.startsWith("!items!"))
      .map(source => [source.item._id, path.basename(source.file, ".json")]));

    assert.equal(items.length, 55);
    assert.equal(folders.length, 9);
    for (const item of items) {
      assert.equal(item.type, "type");
      assert.match(item._key, /^!items![A-Za-z0-9]{16}$/);
      assert.ok(item.name);
      assert.ok(item.system.genre);
      assert.ok(item.system.subgenre);
      assert.ok(item.system.description);
      assert.ok(item.system.statOptions.length > 0);
    }

    const canonicalSlugs = {
      "barbarian-swords-sorcery": "barbarian",
      "archer-epic-fantasy": "archer",
      "soldier-space-opera": "soldier",
      "diplomat-space-opera": "diplomat",
      "medic-space-opera": "medic",
      "noble-hard-science-fiction": "noble"
    };
    for (const item of items) {
      const slug = slugsById.get(item._id);
      const imageSlug = canonicalSlugs[slug] ?? slug.replace(/-rank-\d+$/, "");
      const imageFilename = `${imageSlug}.webp`;
      const expectedPath = fs.existsSync(path.join(root, "assets", "types", imageFilename))
        ? `systems/cypher/assets/types/${imageFilename}`
        : "icons/svg/upgrade.svg";
      assert.equal(item.img, expectedPath, item.name);
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

    const readType = filename => JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8"));
    const mechanics = item => ({
      poolBonuses: item.system.poolBonuses,
      edgeChoice: item.system.edgeChoice,
      woundBonuses: item.system.woundBonuses,
      freeWeapons: item.system.freeWeapons,
      freeArmor: item.system.freeArmor,
      skillOptions: item.system.skillOptions,
      abilities: item.system.abilities,
      statOptions: item.system.statOptions
    });
    const canonicalPairs = [
      ["barbarian-swords-sorcery.json", "barbarian.json"],
      ["archer-epic-fantasy.json", "archer.json"],
      ["soldier-space-opera.json", "soldier.json"],
      ["noble-hard-science-fiction.json", "noble.json"],
      ["medic-space-opera.json", "medic.json"],
      ["diplomat-space-opera.json", "diplomat.json"]
    ];
    for (const [variant, canonical] of canonicalPairs) {
      assert.deepEqual(mechanics(readType(variant)), mechanics(readType(canonical)), variant);
      assert.equal(readType(variant).name, readType(canonical).name, variant);
    }
    assert.equal(readType("soldier.json").system.subgenre, "Hard Science Fiction");
    assert.equal(readType("soldier-space-opera.json").system.subgenre, "Space Opera");

    const crimefighter = JSON.parse(fs.readFileSync(path.join(directory, "crimefighter-rank-1.json"), "utf8"));
    assert.deepEqual(crimefighter.system.poolBonuses, { might: 2, speed: 3, intellect: 5 });
    assert.deepEqual(crimefighter.system.woundBonuses, { minor: 3, moderate: 1, major: 0 });
    assert.equal(crimefighter.system.abilities.length, 3);
  });

  test(`generated ${language} Type abilities have valid item data`, () => {
    const directory = path.join(root, "packs", `types-${language}`, "_source");
    for (const file of fs.readdirSync(directory).filter(file => file.endsWith(".json"))) {
      const item = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
      if (item._key.startsWith("!folders!")) continue;
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

  test(`${language} Type compendium entries are grouped by genre and subgenre`, () => {
    const directory = path.join(root, "packs", `types-${language}`, "_source");
    const entries = fs.readdirSync(directory)
      .filter(file => file.endsWith(".json"))
      .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")));
    const folders = entries.filter(item => item._key.startsWith("!folders!"));
    const items = entries.filter(item => item._key.startsWith("!items!"));
    const genreLabels = language === "en"
      ? { Fantasy: "Fantasy", "Science Fiction": "Science Fiction", Superheroes: "Superheroes" }
      : { Fantasy: "Fantasy", "Science Fiction": "Science-fiction", Superheroes: "Super-héros" };
    const subgenreLabels = language === "en"
      ? {
          "Dungeon Fantasy": "Dungeon Fantasy",
          "Swords & Sorcery": "Swords & Sorcery",
          "Epic Fantasy": "Epic Fantasy",
          "Hard Science Fiction": "Hard Science Fiction",
          "Space Opera": "Space Opera",
          Postapocalypse: "Postapocalypse"
        }
      : {
          "Dungeon Fantasy": "Dungeon Fantasy",
          "Swords & Sorcery": "Épées & Sorcellerie",
          "Epic Fantasy": "Fantasy épique",
          "Hard Science Fiction": "Science-fiction dure",
          "Space Opera": "Space Opera",
          Postapocalypse: "Postapocalyptique"
        };
    const foldersById = new Map(folders.map(folder => [folder._id, folder]));
    const genreFolders = folders.filter(folder => folder.folder == null);
    const subgenreFolders = folders.filter(folder => folder.folder != null);

    assert.equal(folders.length, 9);
    assert.equal(genreFolders.length, 3);
    assert.equal(subgenreFolders.length, 6);
    for (const folder of folders) {
      assert.match(folder._key, /^!folders![A-Za-z0-9]{16}$/);
      assert.equal(folder.type, "Item");
    }
    for (const folder of genreFolders) {
      assert.ok(Object.values(genreLabels).includes(folder.name));
    }
    for (const folder of subgenreFolders) {
      assert.ok(Object.values(subgenreLabels).includes(folder.name));
      assert.ok(genreFolders.some(parent => parent._id === folder.folder));
    }
    for (const item of items) {
      const folder = foldersById.get(item.folder);
      assert.ok(folder, `${item.name} has no genre folder`);
      if (item.system.subgenre === item.system.genre) {
        assert.equal(folder.name, genreLabels[item.system.genre], item.name);
        assert.equal(folder.folder, null, item.name);
      } else {
        assert.equal(folder.name, subgenreLabels[item.system.subgenre], item.name);
        assert.equal(foldersById.get(folder.folder)?.name, genreLabels[item.system.genre], item.name);
      }
    }
  });
}

test("French descriptor sources match the Character Book translations", () => {
  const directory = path.join(root, "packs", "descriptors-fr", "_source");
  const expectedNames = {
    appealing: "Attrayant·e",
    bookish: "Studieux·se",
    brash: "Audacieux·se",
    calm: "Serein·e",
    cautious: "Prudent·e",
    chaotic: "Impulsif·ve",
    charming: "Charmeur·euse",
    clever: "Rusé·e",
    compassionate: "Bienveillant·e",
    creative: "Créatif·ve",
    empathic: "Empathique",
    fast: "Rapide",
    gloomy: "Pessimiste",
    graceful: "Gracieux·se",
    guarded: "Méfiant·e",
    honorable: "Honorable",
    inquisitive: "Curieux·se",
    intelligent: "Intelligent·e",
    intuitive: "Intuitif·ve",
    jovial: "Passionné·e",
    kind: "Aimable",
    mechanical: "Mécanicien·ne",
    mysterious: "Mystérieux·se",
    mystical: "Mystique",
    perceptive: "Observateur·rice",
    resilient: "Résilient·e",
    rugged: "Sauvage",
    skeptical: "Sceptique",
    stealthy: "Furtif·ve",
    strong: "Fort·e",
    "strong-willed": "Têtu·e",
    tough: "Robuste",
    virtuous: "Vertueux·se"
  };

  assert.equal(fs.readdirSync(directory).filter(file => file.endsWith(".json")).length, 33);
  for (const [slug, expectedName] of Object.entries(expectedNames)) {
    const item = JSON.parse(fs.readFileSync(path.join(directory, `${slug}.json`), "utf8"));
    assert.equal(item.name, expectedName, slug);
  }

  const appealing = JSON.parse(fs.readFileSync(path.join(directory, "appealing.json"), "utf8"));
  assert.deepEqual(appealing.system.skillOptions.filter(Boolean), ["Persuasion"]);
  assert.match(appealing.system.description, /Tu es naturellement attirant·e et charismatique/);
});

test("French Type names use the Character Book terminology", () => {
  const directory = path.join(root, "packs", "types-fr", "_source");
  const expectedNames = {
    fighter: "Combattant",
    archer: "Archer·ère",
    "barbarian-swords-sorcery": "Barbare",
    "sword-fighter": "Combattant·e à l’épée",
    "noble-warrior": "Noble guerrier·ère",
    medic: "Toubib",
    "diplomat-space-opera": "Diplomate",
    "medic-space-opera": "Toubib",
    "noble-hard-science-fiction": "Noble",
    "dealer": "Magouilleur·euse",
    heavy: "Bourrin·e",
    "crimefighter-rank-1": "Justicier·ère",
    "vigilante-rank-1": "Vengeur·euse",
    "enhanced-hero-rank-2": "Héros·ïne Augmenté·e",
    "powerstar-rank-2": "Astropuissance",
    "superhuman-rank-3": "Surhumain·e",
    "powerhouse-rank-4": "Colosse",
    "living-god-rank-5": "Dieu Vivant"
  };

  for (const [slug, expectedName] of Object.entries(expectedNames)) {
    const item = JSON.parse(fs.readFileSync(path.join(directory, `${slug}.json`), "utf8"));
    assert.equal(item.name, expectedName, slug);
  }
});