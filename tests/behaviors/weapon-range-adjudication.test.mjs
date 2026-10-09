import assert from "node:assert/strict";
import test from "node:test";

import { resolveWeaponRangeAdjudication } from "../../module/rules/weapon-mechanics.mjs";

test("Given a weapon with a listed range, when the GM marks its range limit, then the attack is hindered once", () => {
  const result = resolveWeaponRangeAdjudication({
    range: "immediate",
    extremeRange: "short",
    atExtremeRange: true
  });

  assert.equal(result.atExtremeRange, true);
  assert.equal(result.hinderSteps, 1);
  assert.equal(result.range, "immediate");
  assert.equal(result.extremeRange, "short");
});

test("Given a target not adjudicated at extreme range, then no range hindrance is added", () => {
  const result = resolveWeaponRangeAdjudication({
    range: "long",
    extremeRange: "",
    atExtremeRange: false
  });

  assert.equal(result.atExtremeRange, false);
  assert.equal(result.hinderSteps, 0);
});

test("Range adjudication preserves the listed categories without measuring tokens", () => {
  const result = resolveWeaponRangeAdjudication({
    range: "long",
    extremeRange: "veryLong",
    atExtremeRange: true
  });

  assert.deepEqual(result, {
    range: "long",
    extremeRange: "veryLong",
    atExtremeRange: true,
    hinderSteps: 1
  });
});
