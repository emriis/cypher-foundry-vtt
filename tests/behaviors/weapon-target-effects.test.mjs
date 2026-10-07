import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveWeaponTargetEffects } from "../../module/rules/weapon-mechanics.mjs";

describe("Given a weapon with structured target effects", () => {
  test("when attacking an eligible target, then the matching effect is carried", () => {
    const effects = [
      {
        minimumTargetLevel: 0,
        maximumTargetLevel: 2,
        effect: "loseNextAction",
        hinderSteps: 0,
        duration: "next action"
      },
      {
        minimumTargetLevel: 3,
        maximumTargetLevel: null,
        effect: "hindered",
        hinderSteps: 2,
        duration: "a round or two"
      }
    ];

    assert.deepEqual(resolveWeaponTargetEffects(effects, 2), [effects[0]]);
    assert.deepEqual(resolveWeaponTargetEffects(effects, 4), [effects[1]]);
  });

  test("when attacking outside a bounded range, then no effect is resolved", () => {
    assert.deepEqual(
      resolveWeaponTargetEffects([{
        minimumTargetLevel: 3,
        maximumTargetLevel: 5,
        effect: "hindered",
        hinderSteps: 2,
        duration: "one round"
      }], 6),
      []
    );
  });
});
