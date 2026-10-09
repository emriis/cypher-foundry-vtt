import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWeaponRangeAdjudication,
  resolveWeaponTargetEffects
} from "../../module/rules/weapon-mechanics.mjs";

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


test("weapon range adjudication adds one hindrance only when explicitly declared", () => {
  assert.deepEqual(resolveWeaponRangeAdjudication({
    range: "long",
    extremeRange: ""
  }), {
    range: "long",
    extremeRange: null,
    atExtremeRange: false,
    hinderSteps: 0
  });

  assert.deepEqual(resolveWeaponRangeAdjudication({
    range: "immediate",
    extremeRange: "short",
    atExtremeRange: true
  }), {
    range: "immediate",
    extremeRange: "short",
    atExtremeRange: true,
    hinderSteps: 1
  });
});

test("weapon range adjudication does not infer range from token distance or missing data", () => {
  assert.deepEqual(resolveWeaponRangeAdjudication({ atExtremeRange: false }), {
    range: null,
    extremeRange: null,
    atExtremeRange: false,
    hinderSteps: 0
  });
  assert.equal(
    resolveWeaponRangeAdjudication({ range: "long", atExtremeRange: "true" })
      .hinderSteps,
    0
  );
});
