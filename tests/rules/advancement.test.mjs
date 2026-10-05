import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceSkillLevel,
  computeAdvancementEffects,
  computeTierAdvancement
} from "../../module/rules/advancement.mjs";

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

test("capability advancement validation requires exactly four points", async () => {
  const { validateAdvancementChoices } =
    await import("../../module/rules/advancement.mjs");

  assert.equal(
    validateAdvancementChoices(
      { type: "capabilities" },
      { distribution: { might: 2, speed: 2, intellect: 0 } }
    ),
    null
  );

  assert.equal(
    validateAdvancementChoices(
      { type: "capabilities" },
      { distribution: { might: 1, speed: 1, intellect: 1 } }
    ),
    "CYPHER.Warning.CapabilitiesMustSumFour"
  );
});

test("skill advancement can target an existing skill or create a new one", () => {
  const system = { effort: 1, stats: {} };

  assert.deepEqual(
    computeAdvancementEffects(
      { type: "skill" },
      { skillId: "stealth" },
      system
    ).skillAction,
    { type: "advance", skillId: "stealth" }
  );

  assert.deepEqual(
    computeAdvancementEffects(
      { type: "skill" },
      { newSkillName: "  Sailing  " },
      system
    ).skillAction,
    { type: "create", name: "Sailing" }
  );
});

test("advancement handles perfection and Effort without exceeding the cap", () => {
  const system = {
    effort: 6,
    stats: {
      might: { pool: { max: 8, value: 8 }, edge: 2 },
      speed: { pool: { max: 8, value: 8 }, edge: 0 },
      intellect: { pool: { max: 8, value: 8 }, edge: 0 }
    }
  };

  assert.equal(
    computeAdvancementEffects(
      { type: "perfection" },
      { stat: "might" },
      system
    ).updates["system.stats.might.edge"],
    3
  );

  assert.equal(
    computeAdvancementEffects({ type: "effort" }, {}, system)
      .updates["system.effort"],
    6
  );
});

test("advancement grants recovery and all configured weapon permissions", async () => {
  const { CYPHER } = await import("../../module/config.mjs");
  const system = {
    effort: 1,
    recoveryBonus: 2,
    stats: {
      might: { pool: { max: 8, value: 8 }, edge: 0 },
      speed: { pool: { max: 8, value: 8 }, edge: 0 },
      intellect: { pool: { max: 8, value: 8 }, edge: 0 }
    }
  };

  assert.equal(
    computeAdvancementEffects(
      { type: "other", otherType: "recovery" },
      {},
      system
    ).updates["system.recoveryBonus"],
    4
  );

  assert.deepEqual(
    computeAdvancementEffects(
      { type: "other", otherType: "weapons" },
      {},
      system
    ).updates,
    {
      "system.freeWeaponCategories": [...CYPHER.weaponCategories],
      "system.canFreelyUseAllWeapons": true
    }
  );
});

test("invalid advancement choices do not silently create skill actions", () => {
  assert.deepEqual(
    computeAdvancementEffects(
      { type: "skill" },
      {},
      { effort: 1, stats: {} }
    ),
    { updates: {}, skillAction: null }
  );
});
