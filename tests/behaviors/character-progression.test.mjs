import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getEligibleFocusAbilities
} from "../../module/rules/focus.mjs";
import {
  computeTierAdvancement
} from "../../module/rules/advancement.mjs";

describe("Given a character progresses through a Focus", () => {
  const focus = {
    abilities: [
      {
        id: "first",
        tier: 1,
        prerequisites: [],
        repeatable: false
      },
      {
        id: "second",
        tier: 2,
        prerequisites: ["first"],
        repeatable: false
      },
      {
        id: "third",
        tier: 3,
        prerequisites: ["second"],
        repeatable: false
      }
    ]
  };

  test("when the character reaches tier 2 after selecting the first ability, then the next ability becomes available", () => {
    assert.deepEqual(
      getEligibleFocusAbilities(focus, ["first"], 2)
        .map(ability => ability.id),
      ["second"]
    );
  });

  test("when the character has not reached the ability tier, then the ability remains unavailable", () => {
    assert.deepEqual(
      getEligibleFocusAbilities(focus, ["first"], 1)
        .map(ability => ability.id),
      []
    );
  });
});

describe("Given a character completes four advancements", () => {
  test("when the character is tier 5, then the next tier is 6 with four fresh slots", () => {
    const result = computeTierAdvancement(5);

    assert.equal(result.newTier, 6);
    assert.equal(result.freshSlots.length, 4);
    assert.ok(result.freshSlots.every(slot => slot.bought === false));
  });

  test("when the character is already at the maximum tier, then the tier stays capped", () => {
    assert.equal(computeTierAdvancement(6).newTier, 6);
  });
});
