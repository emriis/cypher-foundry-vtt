import assert from "node:assert/strict";
import test from "node:test";
import { healingHandUpdates, treatmentProfile } from "../../module/rules/healing.mjs";

test("Given CRD treatment tables, then severity, time profile and machine physiology determine the task", () => {
  assert.deepEqual(treatmentProfile("minor"), { difficulty: 0, time: "oneMinute", skill: "healing" });
  assert.deepEqual(treatmentProfile("major", "realistic"), { difficulty: 6, time: "week", skill: "healing" });
  assert.deepEqual(treatmentProfile("major", "heroic", true), { difficulty: 5, time: "tenMinutes", skill: "engineering" });
  assert.equal(treatmentProfile("unknown"), null);
});

test("Given Healing Hand, then lowering a wound cannot overflow the lower track", () => {
  const wounds = { minor: { current: 3, max: 3 }, moderate: { current: 1, max: 3 }, major: { current: 1, max: 3 } };
  assert.equal(healingHandUpdates(wounds, "moderate"), null);
  assert.deepEqual(healingHandUpdates(wounds, "minor"), { "system.wounds.minor.current": 2 });
  assert.deepEqual(healingHandUpdates(wounds, "major"), { "system.wounds.major.current": 0, "system.wounds.moderate.current": 2 });
});
