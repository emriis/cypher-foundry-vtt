import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  computeRecoveryUpdates,
  getRallyCost
} from "../../module/rules/recovery.mjs";

describe("Given a PC has accumulated wounds", () => {
  test("when the PC completes a ten-minute recovery, then all minor wounds clear", () => {
    const wounds = {
      minor: { current: 2 },
      moderate: { current: 1 },
      major: { current: 0 }
    };

    const result = computeRecoveryUpdates(
      "tenMinutes",
      wounds,
      { tenMinutes: false }
    );

    assert.equal(result.updates["system.wounds.minor.current"], 0);
    assert.equal(result.updates["system.wounds.moderate.current"], undefined);
  });

  test("when the PC completes an hourly recovery, then one moderate wound clears", () => {
    const result = computeRecoveryUpdates(
      "hour",
      {
        minor: { current: 2 },
        moderate: { current: 1 },
        major: { current: 0 }
      },
      { hour: false }
    );

    assert.equal(result.updates["system.wounds.moderate.current"], 0);
    assert.equal(result.updates["system.recoveries.hour"], true);
  });
});

describe("Given a PC wants to rally a wound", () => {
  test("when the PC has enough Might, then the wound can be removed", () => {
    assert.equal(getRallyCost("moderate"), 5);
  });

  test("when the wound is major without the required permission, then rallying is unavailable", () => {
    assert.equal(getRallyCost("major"), null);
  });
});
