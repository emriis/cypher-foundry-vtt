import assert from "node:assert/strict";
import test from "node:test";

const { migrateWorld } = await import("../../module/migration.mjs");

test("the alpha world migration preserves existing documents and settings across repeated calls", async () => {
  const originalGame = Object.getOwnPropertyDescriptor(globalThis, "game");
  const stored = { actor: { xp: 7 }, item: { level: 3 }, settings: { migrationVersion: "legacy" } };
  const initial = structuredClone(stored);
  const rejectWrite = () => assert.fail("The alpha placeholder must not persist world changes");
  globalThis.game = {
    actors: [{ system: stored.actor, update: rejectWrite }],
    items: [{ system: stored.item, update: rejectWrite }],
    settings: {
      get: (_scope, key) => stored.settings[key],
      set: rejectWrite
    }
  };
  try {
    await migrateWorld();
    await migrateWorld();
    assert.deepEqual(stored, initial, "Neither in-memory data nor persisted settings may be migrated yet");
  } finally {
    if (originalGame) Object.defineProperty(globalThis, "game", originalGame);
    else delete globalThis.game;
  }
});
