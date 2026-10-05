import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getEligibleFocusAbilities,
  isFocusAbilityEligible
} from "../../module/rules/focus.mjs";

const focus = {
  abilities: [
    { id: "tier-one", tier: 1, prerequisites: [], repeatable: false },
    { id: "tier-two", tier: 2, prerequisites: ["tier-one"], repeatable: false },
    { id: "repeatable", tier: 1, prerequisites: [], repeatable: true }
  ]
};

describe("Given a character chooses a Focus ability", () => {
  test("when the prerequisite is selected and the tier is reached, then the next ability is eligible", () => {
    assert.equal(
      isFocusAbilityEligible(focus, ["tier-one"], "tier-two", 2),
      true
    );
  });

  test("when the ability is already selected and is not repeatable, then it is rejected", () => {
    assert.equal(
      isFocusAbilityEligible(focus, ["tier-one"], "tier-one", 1),
      false
    );
  });

  test("when the ability is repeatable, then it remains eligible after selection", () => {
    assert.equal(
      isFocusAbilityEligible(focus, ["repeatable"], "repeatable", 1),
      true
    );
  });

  test("when multiple abilities are eligible, then the selection list contains each eligible ability", () => {
    assert.deepEqual(
      getEligibleFocusAbilities(focus, ["tier-one"], 2)
        .map(ability => ability.id),
      ["tier-two", "repeatable"]
    );
  });
});
