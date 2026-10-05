import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  computeRallyResult,
  computeRecoveryUpdates,
  getRallyCost
} from "../../module/rules/recovery.mjs";

describe("Given a character takes a recovery interval", () => {
  test("when the character has a moderate wound at the hourly interval, then one moderate wound is removed", () => {
    const result = computeRecoveryUpdates(
      "hour",
      {
        minor: { current: 2, max: 2 },
        moderate: { current: 2, max: 2 },
        major: { current: 0, max: 1 }
      },
      {}
    );

    assert.equal(result.updates["system.wounds.moderate.current"], 1);
    assert.equal(result.updates["system.wounds.minor.current"], undefined);
  });

  test("when the hourly recovery has already been recorded, then it is not recorded again", () => {
    const result = computeRecoveryUpdates(
      "hour",
      {
        minor: { current: 2, max: 2 },
        moderate: { current: 0, max: 2 },
        major: { current: 0, max: 1 }
      },
      { hour: true }
    );

    assert.equal(result.updates["system.recoveries.hour"], undefined);
  });
});

describe("Given a character rallies a wound", () => {
  test("when Might is sufficient, then the wound decreases and Might is spent", () => {
    const result = computeRallyResult(
      "moderate",
      5,
      {
        minor: { current: 0, max: 2 },
        moderate: { current: 1, max: 2 },
        major: { current: 0, max: 1 }
      }
    );

    assert.equal(result.remainingMight, 5 - getRallyCost("moderate"));
    assert.equal(result.remainingWound, 0);
  });

  test("when the wound is absent, then rallying is rejected", () => {
    assert.equal(
      computeRallyResult(
        "moderate",
        10,
        {
          minor: { current: 0, max: 2 },
          moderate: { current: 0, max: 2 },
          major: { current: 0, max: 1 }
        }
      ),
      null
    );
  });
});
