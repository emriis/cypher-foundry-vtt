import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWeaponConfiguration,
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


test("weapon configuration defaults to primary and preserves its explicit damage", () => {
  assert.deepEqual(resolveWeaponConfiguration({
    attackType: "heavy",
    damage: 7,
    mechanics: { alternateConfiguration: { enabled: true, attackType: "medium", action: "action" } }
  }), {
    configuration: "primary",
    attackType: "heavy",
    baseDamage: 7,
    actionTiming: "lastAction",
    switchAction: "action"
  });
});

test("alternate weapon configuration uses its category and category damage", () => {
  assert.deepEqual(resolveWeaponConfiguration({
    attackType: "heavy",
    damage: 6,
    mechanics: {
      activeConfiguration: "alternate",
      alternateConfiguration: { enabled: true, attackType: "medium", action: "action" }
    }
  }), {
    configuration: "alternate",
    attackType: "medium",
    baseDamage: 4,
    actionTiming: "action",
    switchAction: "action"
  });
});

test("invalid or disabled alternate configuration cannot override the primary weapon", () => {
  assert.equal(resolveWeaponConfiguration({
    attackType: "heavy", damage: 6,
    mechanics: { activeConfiguration: "alternate", alternateConfiguration: { enabled: false, attackType: "medium" } }
  }).baseDamage, 6);
  assert.equal(resolveWeaponConfiguration({
    attackType: "heavy", damage: 6,
    mechanics: { activeConfiguration: "alternate", alternateConfiguration: { enabled: true, attackType: "invalid" } }
  }).attackType, "heavy");
});


test("weapon category resolves the CRD action timing independently of hand use", () => {
  assert.equal(resolveWeaponConfiguration({
    attackType: "light", damage: 2
  }).actionTiming, "firstAction");
  assert.equal(resolveWeaponConfiguration({
    attackType: "medium", damage: 4,
    mechanics: { twoHanded: true }
  }).actionTiming, "action");
  assert.equal(resolveWeaponConfiguration({
    attackType: "heavy", damage: 6,
    mechanics: { twoHanded: false }
  }).actionTiming, "lastAction");
  assert.equal(resolveWeaponConfiguration({
    attackType: null, damage: 0
  }).actionTiming, null);
});
