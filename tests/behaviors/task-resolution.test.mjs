import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canRetryTask,
  resolveAttackDamage,
  resolveSpecialRoll,
  resolveTaskDifficulty
} from "../../module/rules/tasks.mjs";

describe("Given a Cypher task", () => {
  describe("when the character succeeds on a standard task", () => {
    test("then a natural 19 grants a minor effect", () => {
      assert.deepEqual(
        resolveSpecialRoll({
          d20: 19,
          success: true,
          isAttack: false
        }),
        {
          gmIntrusion: false,
          damageBonus: 0,
          effect: "minor",
          effectOptions: [],
          refundsCost: false
        }
      );
    });

    test("then a natural 20 grants a major effect and refunds the cost", () => {
      assert.deepEqual(
        resolveSpecialRoll({
          d20: 20,
          success: true,
          isAttack: false
        }),
        {
          gmIntrusion: false,
          damageBonus: 0,
          effect: "major",
          effectOptions: [],
          refundsCost: true
        }
      );
    });
  });

  describe("when the character fails a non-attack task", () => {
    test("then a retry requires at least one level of Effort", () => {
      assert.equal(
        canRetryTask({
          failed: true,
          isAttack: false,
          effortLevels: 1
        }),
        true
      );
      assert.equal(
        canRetryTask({
          failed: true,
          isAttack: false,
          effortLevels: 0
        }),
        false
      );
    });
  });

  describe("when the task is an attack", () => {
    test("then a failed attack never deals damage", () => {
      assert.equal(resolveAttackDamage(false, 6, 2), 0);
    });

    test("then a successful attack applies its damage bonus", () => {
      assert.equal(resolveAttackDamage(true, 6, 2), 8);
    });

    test("then an attack cannot use the non-combat retry rule", () => {
      assert.equal(
        canRetryTask({
          failed: true,
          isAttack: true,
          effortLevels: 2
        }),
        false
      );
    });
  });

  describe("when task modifiers reduce the difficulty", () => {
    test("then the resulting difficulty cannot become negative", () => {
      assert.deepEqual(resolveTaskDifficulty(3, 5), {
        effectiveDifficulty: 0,
        targetNumber: 0
      });
    });
  });
});

describe("Given a character makes a successful damaging attack", () => {
  test("when the natural roll is 17 or 18, then the attack gains bonus damage", () => {
    assert.equal(
      resolveSpecialRoll({
        d20: 17,
        success: true,
        isAttack: true,
        inflictsDamage: true
      }).damageBonus,
      1
    );
    assert.equal(
      resolveSpecialRoll({
        d20: 18,
        success: true,
        isAttack: true,
        inflictsDamage: true
      }).damageBonus,
      2
    );
  });

  test("when the natural roll is 19 or 20, then the player receives damage/effect choices", () => {
    assert.deepEqual(
      resolveSpecialRoll({
        d20: 19,
        success: true,
        isAttack: true,
        inflictsDamage: true
      }).effectOptions,
      ["damage", "minor"]
    );
    assert.deepEqual(
      resolveSpecialRoll({
        d20: 20,
        success: true,
        isAttack: true,
        inflictsDamage: true
      }).effectOptions,
      ["damage", "major"]
    );
  });
});

describe("Given a character rolls a natural 1", () => {
  test("when the task fails, then a GM intrusion is recorded", () => {
    assert.equal(
      resolveSpecialRoll({
        d20: 1,
        success: false
      }).gmIntrusion,
      true
    );
  });
});
