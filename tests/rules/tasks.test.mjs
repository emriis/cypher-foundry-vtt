import assert from "node:assert/strict";
import test from "node:test";

import {
  clampAssetSteps,
  clampEffortLevels,
  computeEffortCost,
  computeTaskSteps,
  resolveTaskDifficulty
} from "../../module/rules/tasks.mjs";

test("computeEffortCost charges the first level, additional levels, and Edge once", () => {
  assert.equal(computeEffortCost(0), 0);
  assert.equal(computeEffortCost(1), 3);
  assert.equal(computeEffortCost(3), 7);
  assert.equal(computeEffortCost(3, 2), 5);
});

test("computeEffortCost does not charge for zero or negative Effort", () => {
  assert.equal(computeEffortCost(0, 3), 0);
  assert.equal(computeEffortCost(-2, 3), 0);
});

test("clampEffortLevels respects the requested value, character Effort, and ceiling", () => {
  assert.equal(clampEffortLevels(2, 4), 2);
  assert.equal(clampEffortLevels(8, 4), 4);
  assert.equal(clampEffortLevels(8, 8), 6);
  assert.equal(clampEffortLevels(-1, 4), 0);
});

test("clampAssetSteps enforces the two-step Asset limit", () => {
  assert.equal(clampAssetSteps(0), 0);
  assert.equal(clampAssetSteps(1), 1);
  assert.equal(clampAssetSteps(4), 2);
  assert.equal(clampAssetSteps(-1), 0);
});

test("computeTaskSteps combines Effort, Assets, skills, ease, hindrance, and armor", () => {
  assert.equal(
    computeTaskSteps({
      effortLevels: 2,
      assetSteps: 2,
      skillSteps: 1,
      extraEaseSteps: 1,
      woundHinder: 1,
      extraHinderSteps: 1,
      armorModifier: 2,
      autoArmorSpeedHinder: 1
    }),
    5
  );
});

test("resolveTaskDifficulty never produces a negative difficulty", () => {
  assert.deepEqual(resolveTaskDifficulty(6, 3), {
    effectiveDifficulty: 3,
    targetNumber: 9
  });
  assert.deepEqual(resolveTaskDifficulty(3, 5), {
    effectiveDifficulty: 0,
    targetNumber: 0
  });
});
