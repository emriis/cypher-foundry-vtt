import assert from "node:assert/strict";
import test from "node:test";
import { temporaryFollowerPlan, temporaryHealth, temporaryRecoveryUpdates, temporaryFollowerActive } from "../../module/rules/temporary-followers.mjs";
test("the two Basic Necromancy occurrences retain different timing and corpse rules", () => {
  const genre = temporaryFollowerPlan("basic-necromancy", { identity: "ability.basic-necromancy-d68c55e38e39" });
  const focus = temporaryFollowerPlan("basic-necromancy", { identity: "ability.basic-necromancy-455f4fa10b45" });
  assert.ok(genre); assert.ok(focus);
  assert.equal(genre.action, "action"); assert.equal(genre.repairable, false);
  assert.equal(focus.action, "lastAction"); assert.equal(focus.repairable, true);
  assert.equal(temporaryFollowerPlan("basic-necromancy"), null);
  assert.equal(temporaryFollowerPlan("basic-necromancy", { identity: genre.identity, count: 2 }), null);
  const batch = temporaryFollowerPlan("basic-necromancy", { identity: focus.identity, count: 3, improved: true });
  assert.equal(batch.cost, 5); assert.equal(batch.range, "short");
});
test("Greater and True Necromancy pay their additional-body costs without sharing Basic's limit", () => {
  assert.equal(temporaryFollowerPlan("greater-necromancy", { count: 3 }).cost, 9);
  assert.equal(temporaryFollowerPlan("true-necromancy", { count: 3 }).cost, 14);
});
test("Duplicate allocates Effort separately between extra instances and a chosen instance level", () => {
  assert.deepEqual(temporaryFollowerPlan("duplicate", { duplicateEffort: 2, levelEffort: [0, 1, 0] }).levels, [2, 3, 2]);
  assert.equal(temporaryFollowerPlan("duplicate", { duplicateEffort: 1, levelEffort: [1] }), null);
  assert.equal(temporaryFollowerPlan("recompile-machine", { levelEffort: [2] }).maximumLevel, 6);
});
test("adjudicated corpse repair restores full Health only after destruction", () => {
  assert.equal(temporaryHealth({ value: 3, max: 9 }, { repairable: true, repaired: true }), 3);
  assert.equal(temporaryHealth({ value: 0, max: 9 }, { repairable: true, repaired: true }), 9);
  assert.equal(temporaryHealth({ value: 0, max: 9 }, { repairable: false, repaired: true }), null);
  assert.equal(temporaryHealth({ value: 0, max: 9 }, { repairable: true }), null);
});
test("completed recovery invalidates temporary grants atomically, without a 24-hour machine deadline", () => {
  const record = { version: 1, state: "active", key: "recompile-machine", recovery: "tenHours", revision: 0 };
  assert.equal(temporaryFollowerActive(record, {}, 1000000), true);
  const updates = temporaryRecoveryUpdates({ temporaryFollowers: { r: record } }, "tenHours");
  assert.equal(updates["flags.cypher.temporaryRecoveries.tenHours"], 1);
  assert.equal(temporaryFollowerActive(record, { temporaryRecoveries: { tenHours: 1 } }), false);
});
