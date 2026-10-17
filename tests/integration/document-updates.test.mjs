import assert from "node:assert/strict";
import test from "node:test";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";

test("the narrow document double merges maps, replaces arrays and applies explicit deletions without sharing inputs", () => {
  const actor = { system: { stats: { might: 8, speed: 9 }, effects: [1, 2], removed: true } };
  const changes = { "system.stats": { might: 7 }, "system.effects": [3], "system.-=removed": null };
  const snapshot = structuredClone(changes);
  applyDocumentUpdate(actor, changes);
  assert.deepEqual(actor.system, { stats: { might: 7, speed: 9 }, effects: [3] });
  actor.system.effects.push(4);
  assert.deepEqual(changes, snapshot);
});
