import assert from "node:assert/strict";
import test from "node:test";

import { resolveWeaponTargetEffects } from "../../module/rules/weapon-mechanics.mjs";

const effects = [
  {
    minimumTargetLevel: 0,
    maximumTargetLevel: 2,
    effect: "loseNextAction",
    hinderSteps: 0,
    duration: "next action"
  },
  {
    minimumTargetLevel: 3,
    maximumTargetLevel: null,
    effect: "hindered",
    hinderSteps: 1,
    duration: "one round"
  }
];

test("weapon target effects match an inclusive level range", () => {
  assert.deepEqual(resolveWeaponTargetEffects(effects, 2), [effects[0]]);
  assert.deepEqual(resolveWeaponTargetEffects(effects, 3), [effects[1]]);
});

test("weapon target effects accept an open upper bound", () => {
  assert.deepEqual(resolveWeaponTargetEffects(effects, 8), [effects[1]]);
});

test("weapon target effects return no matches outside their ranges", () => {
  const bounded = [{
    minimumTargetLevel: 3,
    maximumTargetLevel: 5,
    effect: "hindered"
  }];

  assert.deepEqual(resolveWeaponTargetEffects(bounded, 2), []);
  assert.deepEqual(resolveWeaponTargetEffects(bounded, 6), []);
});

test("weapon target effects reject an invalid target level", () => {
  assert.deepEqual(resolveWeaponTargetEffects(effects, -1), []);
  assert.deepEqual(resolveWeaponTargetEffects(effects, "3"), []);
});

test("weapon target effects preserve source order", () => {
  const overlapping = [
    { minimumTargetLevel: 0, maximumTargetLevel: null, effect: "hindered" },
    { minimumTargetLevel: 2, maximumTargetLevel: null, effect: "loseNextAction" }
  ];

  assert.deepEqual(
    resolveWeaponTargetEffects(overlapping, 3),
    overlapping
  );
});
