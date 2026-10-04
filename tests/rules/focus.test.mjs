import assert from "node:assert/strict";
import test from "node:test";

import {
  getEligibleFocusAbilities,
  isFocusAbilityEligible
} from "../../module/rules/focus.mjs";

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
