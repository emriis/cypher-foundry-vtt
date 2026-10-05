import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  computeAdvancementEffects,
  computeTierAdvancement,
  validateAdvancementChoices
} from "../../module/rules/advancement.mjs";
import { CYPHER } from "../../module/config.mjs";

describe("Given a character purchases an advancement", () => {
  test("when the character chooses recovery, then the recovery bonus increases", () => {
    const result = computeAdvancementEffects(
      { type: "other", otherType: "recovery" },
      {},
      { recoveryBonus: 2 }
    );

    assert.equal(result.updates["system.recoveryBonus"], 4);
  });

  test("when the character chooses armor training, then all configured armor categories become free", () => {
    const result = computeAdvancementEffects(
      { type: "other", otherType: "armor" }
    );

    assert.deepEqual(
      result.updates["system.freeArmorCategories"],
      CYPHER.armorCategoryIds
    );
    assert.equal(result.updates["system.canFreelyUseAllArmor"], true);
  });

  test("when the character chooses weapon training, then all configured weapon categories become free", () => {
    const result = computeAdvancementEffects(
      { type: "other", otherType: "weapons" }
    );

    assert.deepEqual(
      result.updates["system.freeWeaponCategories"],
      CYPHER.weaponCategories
    );
    assert.equal(result.updates["system.canFreelyUseAllWeapons"], true);
  });

  test("when capabilities are distributed across stats, then each selected Pool max and value increases", () => {
    const result = computeAdvancementEffects(
      { type: "capabilities" },
      { distribution: { might: 2, intellect: 2 } },
      {
        stats: {
          might: { pool: { max: 6, value: 4 } },
          speed: { pool: { max: 7, value: 7 } },
          intellect: { pool: { max: 5, value: 3 } }
        }
      }
    );

    assert.equal(result.updates["system.stats.might.pool.max"], 8);
    assert.equal(result.updates["system.stats.might.pool.value"], 6);
    assert.equal(result.updates["system.stats.intellect.pool.max"], 7);
    assert.equal(result.updates["system.stats.intellect.pool.value"], 5);
  });
});

describe("Given a character chooses the capabilities advancement", () => {
  test("when the four points are not fully distributed, then the choice is rejected", () => {
    assert.equal(
      validateAdvancementChoices(
        { type: "capabilities" },
        { distribution: { might: 1, speed: 1, intellect: 1 } }
      ),
      "CYPHER.Warning.CapabilitiesMustSumFour"
    );
  });
});

describe("Given a character completes a tier", () => {
  test("when the current tier is below the cap, then the next tier is created with four fresh slots", () => {
    const result = computeTierAdvancement(4);

    assert.equal(result.newTier, 5);
    assert.equal(result.freshSlots.length, 4);
    assert.ok(result.freshSlots.every(slot => slot.bought === false));
  });
});
