import assert from "node:assert/strict";
import test from "node:test";

import {
  computeWoundIncrease,
  convertDamageToWound,
  reduceWoundSeverity,
  resolveShieldWoundSeverity
} from "../../module/rules/wounds.mjs";

test("wound severity reduction follows the three-step wound track", () => {
  assert.equal(reduceWoundSeverity("major"), "moderate");
  assert.equal(reduceWoundSeverity("moderate"), "minor");
  assert.equal(reduceWoundSeverity("minor"), null);
  assert.equal(reduceWoundSeverity("unknown"), null);
});

test("wound overflow cascades into the next track", () => {
  const wounds = {
    minor: { current: 3, max: 3 },
    moderate: { current: 2, max: 3 },
    major: { current: 0, max: 3 }
  };

  assert.deepEqual(computeWoundIncrease("minor", wounds), {
    target: "moderate",
    current: 3,
    max: 3
  });
});

test("shield wound overflow uses the same severity cascade", () => {
  const wounds = {
    minor: { current: 3, max: 3 },
    moderate: { current: 2, max: 2 },
    major: { current: 0, max: 1 }
  };

  assert.equal(resolveShieldWoundSeverity("minor", wounds), "major");
});

test("Pool overflow maps to the configured wound severity", () => {
  assert.equal(convertDamageToWound(1), "minor");
  assert.equal(convertDamageToWound(4), "minor");
  assert.equal(convertDamageToWound(5), "moderate");
  assert.equal(convertDamageToWound(8), "moderate");
  assert.equal(convertDamageToWound(9), "major");
});
