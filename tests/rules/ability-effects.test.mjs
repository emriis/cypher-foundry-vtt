import assert from "node:assert/strict";
import test from "node:test";

import {
  abilityEffectEndsOnRecovery,
  recoverySatisfiesEndCondition
} from "../../module/rules/ability-effects.mjs";

test("an exact recovery condition matches only its interval", () => {
  const condition = {
    kind: "recovery",
    interval: "hour",
    minimum: false
  };

  assert.equal(recoverySatisfiesEndCondition("tenMinutes", condition), false);
  assert.equal(recoverySatisfiesEndCondition("hour", condition), true);
  assert.equal(recoverySatisfiesEndCondition("tenHours", condition), false);
});

test("a minimum recovery condition also matches longer recoveries", () => {
  const condition = {
    kind: "recovery",
    interval: "tenMinutes",
    minimum: true
  };

  assert.equal(recoverySatisfiesEndCondition("action", condition), false);
  assert.equal(recoverySatisfiesEndCondition("tenMinutes", condition), true);
  assert.equal(recoverySatisfiesEndCondition("hour", condition), true);
  assert.equal(recoverySatisfiesEndCondition("tenHours", condition), true);
});

test("any recovery condition matches every supported recovery interval", () => {
  const condition = {
    kind: "recovery",
    interval: "any",
    minimum: false
  };

  for (const interval of ["action", "tenMinutes", "hour", "tenHours"]) {
    assert.equal(recoverySatisfiesEndCondition(interval, condition), true);
  }
});

test("non-recovery conditions do not end an effect in this rule", () => {
  assert.equal(
    recoverySatisfiesEndCondition("hour", {
      kind: "unsupported",
      interval: "hour",
      minimum: true
    }),
    false
  );
});

test("an effect ends when any structured recovery condition matches", () => {
  assert.equal(
    abilityEffectEndsOnRecovery(
      {
        endConditions: [
          { kind: "recovery", interval: "hour", minimum: true }
        ]
      },
      "tenHours"
    ),
    true
  );

  assert.equal(
    abilityEffectEndsOnRecovery(
      {
        endConditions: [
          { kind: "recovery", interval: "hour", minimum: true }
        ]
      },
      "tenMinutes"
    ),
    false
  );
});
