import test from "node:test";
import assert from "node:assert/strict";
import { libraryIndex, libraryDocument, createLibraryShortcut, libraryActors } from "../../module/applications/library-service.mjs";

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
