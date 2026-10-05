import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  computeWoundIncrease,
  reduceWoundSeverity,
  resolveWoundSeverity
} from "../../module/rules/wounds.mjs";

describe("Given a character receives a wound", () => {
  const track = {
    minor: { current: 2, max: 2 },
    moderate: { current: 0, max: 2 },
    major: { current: 0, max: 1 }
  };

  test("when the minor track is full, then a new minor wound escalates to moderate", () => {
    assert.equal(resolveWoundSeverity("minor", track), "moderate");
    assert.deepEqual(computeWoundIncrease("minor", track), {
      target: "moderate",
      current: 1,
      max: 2
    });
  });

  test("when minor and moderate tracks are full, then the wound escalates to major", () => {
    const full = {
      ...track,
      moderate: { current: 2, max: 2 }
    };

    assert.equal(resolveWoundSeverity("minor", full), "major");
  });
});

describe("Given a character recovers from a wound", () => {
  test("when a major wound is reduced, then it becomes moderate", () => {
    assert.equal(reduceWoundSeverity("major"), "moderate");
  });

  test("when a minor wound is reduced, then it disappears", () => {
    assert.equal(reduceWoundSeverity("minor"), null);
  });
});
