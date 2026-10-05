import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  resolveNpcDamage,
  resolvePoolDamage
} from "../../module/rules/wounds.mjs";

describe("Given a PC takes damage to a stat Pool", () => {
  test("when the damage exceeds the Pool, then only the overflow becomes a wound", () => {
    assert.deepEqual(resolvePoolDamage(6, 3), {
      poolDamage: 3,
      overflow: 3,
      woundSeverity: "minor"
    });
  });

  test("when the damage does not exceed the Pool, then no wound is created", () => {
    assert.deepEqual(resolvePoolDamage(3, 5), {
      poolDamage: 3,
      overflow: 0,
      woundSeverity: null
    });
  });

  test("when the incoming damage is negative, then it cannot heal the Pool", () => {
    assert.deepEqual(resolvePoolDamage(-4, 5), {
      poolDamage: 0,
      overflow: 0,
      woundSeverity: null
    });
  });
});

describe("Given an NPC takes damage", () => {
  test("when the NPC has Armor, then Armor absorbs damage before Health", () => {
    assert.equal(resolveNpcDamage(8, 3), 5);
  });

  test("when Armor exceeds the incoming damage, then no Health damage is dealt", () => {
    assert.equal(resolveNpcDamage(3, 5), 0);
  });
});
