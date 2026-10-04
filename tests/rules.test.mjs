import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceSkillLevel,
  computeAdvancementEffects,
  computeTierAdvancement
} from "../module/rules/advancement.mjs";
import { resolveDefense } from "../module/rules/defense.mjs";
import {
  getEligibleFocusAbilities,
  isFocusAbilityEligible
} from "../module/rules/focus.mjs";
import {
  computeRallyResult,
  computeRecoveryUpdates,
  getRallyCost,
  getRecoveryRollData
} from "../module/rules/recovery.mjs";
import {
  computeWoundIncrease,
  convertDamageToWound,
  reduceWoundSeverity,
  resolveShieldWoundSeverity
} from "../module/rules/wounds.mjs";

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

test("defense resolution selects the correct stat and armor modifier", () => {
  assert.deepEqual(resolveDefense("block", {
    blockEase: 2,
    dodgeHinder: 3
  }), {
    stat: "might",
    armorModifier: 2
  });

  assert.deepEqual(resolveDefense("dodge", {
    blockEase: 2,
    dodgeHinder: 3
  }), {
    stat: "speed",
    armorModifier: -3
  });
});

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
      { tenMinutes: true }
    ),
    {
      updates: {
        "system.wounds.minor.current": 0
      },
      woundNoteKey: "CYPHER.Recovery.RemovesAllMinor"
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

test("advancement skill progression follows the configured skill ladder", () => {
  assert.equal(advanceSkillLevel("inability"), "trained");
  assert.equal(advanceSkillLevel("practiced"), "trained");
  assert.equal(advanceSkillLevel("trained"), "specialized");
  assert.equal(advanceSkillLevel("specialized"), "expert");
  assert.equal(advanceSkillLevel("expert"), "expert");
});

test("advancement effects calculate capabilities, Effort, and permissions", () => {
  const system = {
    effort: 5,
    recoveryBonus: 0,
    stats: {
      might: { pool: { max: 8, value: 8 }, edge: 0 },
      speed: { pool: { max: 8, value: 8 }, edge: 0 },
      intellect: { pool: { max: 8, value: 8 }, edge: 0 }
    }
  };

  assert.deepEqual(
    computeAdvancementEffects(
      { type: "capabilities" },
      { distribution: { might: 2, speed: 1 } },
      system
    ).updates,
    {
      "system.stats.might.pool.max": 10,
      "system.stats.might.pool.value": 10,
      "system.stats.speed.pool.max": 9,
      "system.stats.speed.pool.value": 9
    }
  );

  assert.equal(
    computeAdvancementEffects({ type: "effort" }, {}, system)
      .updates["system.effort"],
    6
  );

  assert.deepEqual(
    computeAdvancementEffects(
      { type: "other", otherType: "armor" },
      {},
      system
    ).updates,
    {
      "system.freeArmorCategories": ["light", "medium", "heavy"],
      "system.canFreelyUseAllArmor": true
    }
  );
});

test("tier advancement resets four slots and caps the tier", () => {
  const result = computeTierAdvancement(5);
  assert.equal(result.newTier, 6);
  assert.equal(result.freshSlots.length, 4);
  assert.ok(result.freshSlots.every(slot => !slot.bought));

  assert.equal(computeTierAdvancement(6).newTier, 6);
});

test("Focus eligibility uses tier and prerequisite links", () => {
  const focus = {
    abilities: [
      { id: "first", tier: 1, prerequisites: [], repeatable: false },
      { id: "second", tier: 1, prerequisites: [], repeatable: false },
      {
        id: "third",
        tier: 2,
        prerequisites: ["first", "second"],
        repeatable: false
      },
      {
        id: "repeatable",
        tier: 2,
        prerequisites: ["first"],
        repeatable: true
      }
    ]
  };

  assert.equal(
    isFocusAbilityEligible(focus, ["first"], "third", 2),
    true
  );
  assert.equal(
    isFocusAbilityEligible(focus, ["first"], "third", 1),
    false
  );
  assert.equal(
    isFocusAbilityEligible(focus, ["first"], "first", 2),
    false
  );

  assert.deepEqual(
    getEligibleFocusAbilities(focus, ["first"], 2)
      .map(ability => ability.id),
    ["second", "third", "repeatable"]
  );
});
