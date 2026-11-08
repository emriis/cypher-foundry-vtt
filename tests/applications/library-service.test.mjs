import test from "node:test";
import assert from "node:assert/strict";
import { libraryIndex, libraryDocument, createLibraryShortcut, libraryActors, libraryGMActors } from "../../module/applications/library-service.mjs";

function setup() {
  const calls = { index: 0, document: 0, create: 0 };
  const document = { documentName: "JournalEntry", testUserPermission: () => true };
  const pack = { visible: true, documentName: "JournalEntry", collection: "cypher.rules-en",
    async getIndex() { calls.index++; return [{ _id: "stable", name: "Rule", flags: { cypherFoundry: { crd: { logicalId: "journal.task-difficulty" } } } }]; },
    async getDocument() { calls.document++; return document; } };
  const user = { id: "reader", hasPermission: () => true };
  globalThis.game = { user, packs: new Map([[pack.collection, pack]]), macros: [], actors: [],
    i18n: { localize: key => key } };
  globalThis.canvas = { tokens: { controlled: [] } };
  globalThis.foundry = { documents: { Macro: { implementation: {
    canUserCreate: () => true,
    async create(data) { calls.create++; const macro = { ...data, isAuthor: true, isOwner: true }; game.macros.push(macro); return macro; }
  } } } };
  return { calls, pack, document };
}

test("GM resources stay lazy and permission checked in both languages", async () => {
  const { pack, calls, document } = setup();
  for (const language of ["en", "fr"]) {
    pack.collection = `cypher.rules-${language}`;
    game.packs = new Map([[pack.collection, pack]]);
    pack.getIndex = async () => ["gm-guide", "gm-screen"].map(key => ({ _id: key, name: key,
      flags: { cypherFoundry: { crd: { logicalId: `journal.${key}` } } } }));
    const before = calls.document;
    const rows = (await libraryIndex(language)).filter(row => row.section === "gm");
    assert.equal(rows.length, 2);
    assert.equal(calls.document, before);
    for (const row of rows) assert.equal(await libraryDocument(row.key, language), document);
    document.testUserPermission = () => false;
    assert.equal(await libraryDocument("gm-screen", language), null);
    document.testUserPermission = () => true;
    pack.visible = false;
    assert.equal(await libraryDocument("gm-guide", language), null);
    pack.visible = true;
  }
});

test("GM sheet candidates preserve synthetic identity and reject players and revoked ownership", () => {
  setup();
  const world = { uuid: "Actor.n", type: "npc", isOwner: true };
  const token = { uuid: "Scene.s.Token.t.Actor.n", type: "npc", isOwner: true };
  const object = { uuid: "Actor.o", type: "object", isOwner: true };
  const denied = { uuid: "Actor.d", type: "pc", isOwner: false };
  game.actors = [world, object, denied];
  canvas.tokens.controlled = [{ actor: token }, { actor: denied }];
  assert.deepEqual(libraryGMActors(), []);
  game.user.isGM = true;
  assert.deepEqual(libraryGMActors(), [token, world, object]);
  token.isOwner = false;
  assert.deepEqual(libraryGMActors(), [world, object]);
});

test("Library resolves stable logical identities lazily and rejects unknown keys and languages", async () => {
  const { calls } = setup();
  const rows = await libraryIndex("en");
  assert.equal(rows.find(row => row.key === "task-difficulty").uuid, "Compendium.cypher.rules-en.JournalEntry.stable");
  assert.equal(calls.index, 1);
  assert.equal(calls.document, 0);
  assert.equal(await libraryDocument("unknown", "en"), null);
  assert.equal(await libraryDocument("task-difficulty", "de"), null);
  assert.equal(calls.document, 0);
  assert.ok(await libraryDocument("task-difficulty", "en"));
  assert.equal(calls.document, 1);
});

test("Library never reads hidden packs or returns denied, ambiguous or wrong-type content", async () => {
  const { pack, calls, document } = setup();
  pack.visible = false;
  assert.equal(await libraryDocument("task-difficulty", "en"), null);
  assert.equal(calls.index, 0);
  pack.visible = true;
  document.testUserPermission = () => false;
  assert.equal(await libraryDocument("task-difficulty", "en"), null);
  document.testUserPermission = () => true;
  document.documentName = "Item";
  assert.equal(await libraryDocument("task-difficulty", "en"), null);
  const original = pack.getIndex;
  pack.getIndex = async () => { const rows = await original(); return [...rows, { ...rows[0], _id: "duplicate" }]; };
  assert.equal(await libraryDocument("task-difficulty", "en"), null);
});

test("French lookup uses source identity and its own pack without English fallback", async () => {
  const { pack, document } = setup();
  assert.equal(await libraryDocument("task-difficulty", "fr"), null);
  pack.collection = "cypher.rules-fr";
  pack.getIndex = async () => [{ _id: "french", name: "Difficulté", flags: { cypherFoundry: { crd: { sourceLogicalId: "journal.task-difficulty" } } } }];
  game.packs.set(pack.collection, pack);
  assert.equal(await libraryDocument("task-difficulty", "fr"), document);
});

test("Chapter and contents discovery uses the same permission checked lazy resolver", async () => {
  const { pack, document } = setup();
  pack.getIndex = async () => [{ _id: "chapter", name: "Skills", flags: { cypherFoundry: { crd: { logicalId: "journal.crd-skills" } } } }];
  const chapter = (await libraryIndex("en")).find(row => row.key === "crd-skills");
  assert.ok(chapter?.uuid);
  assert.equal(chapter.section, "chapter");
  assert.equal(await libraryDocument("crd-skills", "en"), document);
});

test("All five genre chapters are lazy, paired-language destinations with fresh permission checks", async () => {
  const { pack, calls, document } = setup();
  const keys = ["real-world", "genre-abilities", "fantasy", "science-fiction", "superheroes"];
  for (const language of ["en", "fr"]) {
    pack.collection = `cypher.rules-${language}`;
    game.packs = new Map([[pack.collection, pack]]);
    pack.getIndex = async () => keys.map(key => ({ _id: key, name: key, flags: { cypherFoundry: { crd: {
      [language === "fr" ? "sourceLogicalId" : "logicalId"]: `journal.crd-${key}`
    } } } }));
    const rows = (await libraryIndex(language)).filter(row => keys.some(key => row.key === `crd-${key}`));
    assert.equal(rows.length, 5);
    assert.equal(calls.document, language === "fr" ? 5 : 0);
    for (const row of rows) {
      assert.equal(row.section, "chapter");
      assert.ok(row.uuid.startsWith(`Compendium.cypher.rules-${language}.JournalEntry.`));
      assert.equal(await libraryDocument(row.key, language), document);
    }
  }
  document.testUserPermission = () => false;
  assert.equal(await libraryDocument("crd-fantasy", "fr"), null);
});

test("Foci and equipment chapters resolve lazily in both languages and never bypass hidden packs", async () => {
  const { pack, calls, document } = setup();
  for (const language of ["en", "fr"]) {
    pack.collection = `cypher.rules-${language}`;
    game.packs = new Map([[pack.collection, pack]]);
    pack.getIndex = async () => ["foci", "equipment"].map(key => ({ _id: key, name: key,
      flags: { cypherFoundry: { crd: { sourceLogicalId: `journal.crd-${key}` } } } }));
    const destinations = (await libraryIndex(language)).filter(row => ["crd-foci", "crd-equipment"].includes(row.key));
    assert.equal(destinations.length, 2);
    assert.ok(destinations.every(row => row.section === "chapter" && row.uuid.includes(`rules-${language}.JournalEntry`)));
    const before = calls.document;
    assert.equal(await libraryDocument("crd-foci", language), document);
    assert.equal(calls.document, before + 1);
    pack.visible = false;
    assert.equal(await libraryDocument("crd-equipment", language), null);
    assert.equal(calls.document, before + 1);
    pack.visible = true;
  }
});

test("Cypher reference discovery is bilingual, lazy and permission checked", async () => {
  const { pack, calls, document } = setup();
  for (const language of ["en", "fr"]) {
    pack.collection = `cypher.rules-${language}`;
    game.packs = new Map([[pack.collection, pack]]);
    pack.getIndex = async () => [{ _id: "cyphers", name: "Cyphers", flags: {
      cypherFoundry: { crd: { logicalId: "journal.crd-cyphers" } }
    } }];
    const before = calls.document;
    const row = (await libraryIndex(language)).find(row => row.key === "crd-cyphers");
    assert.equal(row.uuid, `Compendium.cypher.rules-${language}.JournalEntry.cyphers`);
    assert.equal(calls.document, before);
    assert.equal(await libraryDocument("crd-cyphers", language), document);
    document.testUserPermission = () => false;
    assert.equal(await libraryDocument("crd-cyphers", language), null);
    document.testUserPermission = () => true;
  }
});

test("Final rules, advancement and credits are lazy bilingual references with fresh permission checks", async () => {
  const { pack, calls, document } = setup();
  const keys = ["rules-of-the-game", "advancing-your-character", "credits"];
  for (const language of ["en", "fr"]) {
    pack.collection = `cypher.rules-${language}`;
    game.packs = new Map([[pack.collection, pack]]);
    pack.getIndex = async () => keys.map(key => ({ _id: key, name: key,
      flags: { cypherFoundry: { crd: { logicalId: `journal.crd-${key}` } } } }));
    const before = calls.document;
    const rows = (await libraryIndex(language)).filter(row => keys.some(key => row.key === `crd-${key}`));
    assert.equal(rows.length, 3);
    assert.equal(calls.document, before);
    for (const row of rows) assert.equal(await libraryDocument(row.key, language), document);
    document.testUserPermission = () => false;
    assert.equal(await libraryDocument("crd-credits", language), null);
    document.testUserPermission = () => true;
  }
});

test("Player resources are separate lazy roles with bilingual permission checks", async () => {
  const { pack, calls, document } = setup();
  for (const language of ["en", "fr"]) {
    pack.collection = `cypher.rules-${language}`;
    game.packs = new Map([[pack.collection, pack]]);
    pack.getIndex = async () => ["player-guide", "player-quick-reference"].map(key => ({ _id: key, name: key,
      flags: { cypherFoundry: { crd: { logicalId: `journal.${key}` } } } }));
    const before = calls.document;
    const rows = (await libraryIndex(language)).filter(row => row.key.startsWith("player-"));
    assert.deepEqual(rows.map(row => row.section), ["guide", "cards"]);
    assert.equal(calls.document, before);
    assert.equal(await libraryDocument("player-guide", language), document);
    document.testUserPermission = () => false;
    assert.equal(await libraryDocument("player-quick-reference", language), null);
    document.testUserPermission = () => true;
    pack.visible = false;
    assert.equal(await libraryDocument("player-guide", language), null);
    pack.visible = true;
  }
});

test("Home shortcut is permission checked, repeatable, and preserves user-edited macros", async () => {
  const { calls } = setup();
  const first = await createLibraryShortcut();
  assert.equal(await createLibraryShortcut(), first);
  assert.equal(calls.create, 1);
  first.command = "// user customization";
  const replacement = await createLibraryShortcut();
  assert.notEqual(first, replacement);
  assert.equal(first.command, "// user customization");
  assert.equal(calls.create, 2);
  game.user.hasPermission = () => false;
  assert.equal(await createLibraryShortcut(), null);
  assert.equal(calls.create, 2);
});

test("Concurrent shortcut requests create once and never reuse another author's macro", async () => {
  setup();
  const [first, busy] = await Promise.all([createLibraryShortcut(), createLibraryShortcut()]);
  assert.ok(first);
  assert.equal(busy, null);
  first.isAuthor = false;
  assert.notEqual(await createLibraryShortcut(), first);
});

test("Task candidate selection keeps actual owned synthetic Actors and excludes unowned PCs", () => {
  setup();
  const world = { id: "same", uuid: "Actor.same", type: "pc", isOwner: true };
  const synthetic = { id: "same", uuid: "Scene.s.Token.t.Actor.same", type: "pc", isOwner: true };
  const denied = { uuid: "Actor.denied", type: "pc", isOwner: false };
  game.actors = [world, denied];
  canvas.tokens.controlled = [{ actor: synthetic }, { actor: denied }];
  game.user.character = world;
  assert.deepEqual(libraryActors(), [synthetic, world]);
});
