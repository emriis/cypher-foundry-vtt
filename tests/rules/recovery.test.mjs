import assert from "node:assert/strict";
import test from "node:test";

import {
  computeRallyResult,
  computeRecoveryUpdates,
  getRallyCost,
  getRecoveryRollData
} from "../../module/rules/recovery.mjs";

test("recovery rules build the configured roll and wound updates", () => {
  assert.deepEqual(getRecoveryRollData(3, 2), {
    formula: "1d6 + @tier + @bonus",
    data: { tier: 3, bonus: 2 }
  });

  const result = computeRecoveryUpdates(
    "hour",
    {
      minor: { current: 2 },
      moderate: { current: 1 }
    },
    { hour: false }
  );

  assert.deepEqual(result, {
    updates: {
      "system.wounds.moderate.current": 0,
      "system.recoveries.hour": true
    },
    woundNoteKey: "CYPHER.Recovery.RemovesOneModerate"
  });
});

test("recovery clears all minor wounds at ten minutes", () => {
  assert.deepEqual(
    computeRecoveryUpdates(
      "tenMinutes",
      {
        minor: { current: 3 },
        moderate: { current: 2 }
      },
      { tenMinutes: false }
    ),
    {
      updates: {
        "system.wounds.minor.current": 0,
        "system.recoveries.tenMinutes": true
      },
      woundNoteKey: "CYPHER.Recovery.RemovesAllMinor"
    }
  );
});

test("ten-hour recovery clears moderate wounds and records the recovery", () => {
  assert.deepEqual(
    computeRecoveryUpdates(
      "tenHours",
      {
        minor: { current: 1 },
        moderate: { current: 2 }
      },
      {}
    ),
    {
      updates: {
        "system.wounds.moderate.current": 0,
        ...Object.fromEntries(["action", "tenMinutes", "hour", "tenHours"].map(key => [`system.recoveries.${key}`, false]))
      },
      woundNoteKey: "CYPHER.Recovery.RemovesAllModerate"
    }
  );
});

test("rally rules enforce major-wound permission and Might cost", () => {
  assert.equal(getRallyCost("minor"), 2);
  assert.equal(getRallyCost("moderate"), 5);
  assert.equal(getRallyCost("major"), null);
  assert.equal(getRallyCost("major", true), 10);

  const wounds = {
    minor: { current: 1 },
    moderate: { current: 1 },
    major: { current: 0 }
  };

  assert.deepEqual(
    computeRallyResult("moderate", 6, wounds),
    {
      cost: 5,
      remainingMight: 1,
      remainingWound: 0
    }
  );
  assert.equal(computeRallyResult("minor", 1, wounds), null);
  assert.equal(computeRallyResult("major", 20, wounds), null);
});

test("hourly recovery clears all minor wounds when no moderate wound remains", () => {
  assert.deepEqual(
    computeRecoveryUpdates(
      "hour",
      {
        minor: { current: 3 },
        moderate: { current: 0 }
      },
      {}
    ),
    {
      updates: {
        "system.wounds.minor.current": 0,
        "system.recoveries.hour": true
      },
      woundNoteKey: "CYPHER.Recovery.RemovesAllMinor"
    }
  );
});

test("Given a used recovery, then another activation cannot heal another wound", () => {
  assert.deepEqual(
    computeRecoveryUpdates(
      "hour",
      {
        minor: { current: 1 },
        moderate: { current: 0 }
      },
      { hour: true }
    ),
    {
      updates: {},
      woundNoteKey: null
    }
  );
});

test("Given an hourly recovery, then the player can choose minor wounds even with a moderate wound present", () => {
  const result = computeRecoveryUpdates("hour", { minor: { current: 2 }, moderate: { current: 1 } }, {}, { woundChoice: "minor" });
  assert.equal(result.updates["system.wounds.minor.current"], 0);
  assert.equal(result.updates["system.wounds.moderate.current"], undefined);
});

test("Given a ten-hour recovery, then exchanging one moderate removal clears every minor wound", () => {
  const result = computeRecoveryUpdates("tenHours", { minor: { current: 3 }, moderate: { current: 2 } }, {}, { woundChoice: "minor" });
  assert.equal(result.updates["system.wounds.minor.current"], 0);
  assert.equal(result.updates["system.wounds.moderate.current"], 1);
});

test("Given no moderate wounds, then the adopted ten-hour adjudication still permits clearing minor wounds", () => {
  const result = computeRecoveryUpdates("tenHours", { minor: { current: 3 }, moderate: { current: 0 } }, {}, { woundChoice: "minor" });
  assert.equal(result.updates["system.wounds.minor.current"], 0);
  assert.equal(result.updates["system.wounds.moderate.current"], 0);
});

test("Given an unknown interval, then recovery cannot change wounds or invent a marker", () => {
  assert.deepEqual(computeRecoveryUpdates("week", { minor: { current: 2 }, moderate: { current: 1 } }), { updates: {}, woundNoteKey: null });
});

test("rallying requires an existing wound and sufficient Might", () => {
  const wounds = {
    minor: { current: 1 },
    moderate: { current: 1 },
    major: { current: 0 }
  };

  assert.equal(computeRallyResult("moderate", 4, wounds), null);
  assert.equal(computeRallyResult("major", 20, wounds, true), null);
});

test("major wounds can be rallied when the permission is present", () => {
  const wounds = {
    minor: { current: 0 },
    moderate: { current: 0 },
    major: { current: 2 }
  };

  assert.deepEqual(
    computeRallyResult("major", 12, wounds, true),
    {
      cost: 10,
      remainingMight: 2,
      remainingWound: 1
    }
  );
});
