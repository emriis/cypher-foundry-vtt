/** CRD / Actions and Initiative: Speed roll, target-number NPCs and PC ties. */
import assert from "node:assert/strict";
import test from "node:test";
import { compareInitiative, resolveInitiativeScore, resolveNpcInitiative } from "../../module/rules/initiative.mjs";

test("initiative keeps easing above twenty and hindrance below zero", () => {
  assert.equal(resolveInitiativeScore(20, 3), 29);
  assert.equal(resolveInitiativeScore(1, -2), -5);
  assert.equal(resolveInitiativeScore(12, 1), 15);
  assert.equal(resolveInitiativeScore(0, 0), null);
  assert.equal(resolveInitiativeScore(12, 0.5), null);
  assert.equal(resolveNpcInitiative(2), 6);
  assert.equal(resolveNpcInitiative(-1), null);
});

test("a PC equal to an NPC target number acts first, and unrolled entries stay last", () => {
  const entries = [{ id: "a", initiative: 6, actor: { type: "npc" } },
    { id: "b", initiative: 6, actor: { type: "pc" } },
    { id: "c", initiative: null, actor: { type: "pc" } },
    { id: "d", initiative: -3, actor: { type: "pc" } }];
  assert.deepEqual(entries.sort(compareInitiative).map(entry => entry.id), ["b", "a", "d", "c"]);
});
