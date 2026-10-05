import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveDefense } from "../../module/rules/defense.mjs";
import { computeTaskSteps } from "../../module/rules/tasks.mjs";

describe("Given a character chooses a defense", () => {
  test("when blocking with armor, then Might and armor Block ease are used", () => {
    assert.deepEqual(resolveDefense("block", { blockEase: 2 }), {
      stat: "might", armorModifier: 2
    });
  });

  test("when dodging with armor, then Speed and armor Dodge hindrance are used", () => {
    assert.deepEqual(resolveDefense("dodge", { dodgeHinder: 2 }), {
      stat: "speed", armorModifier: -2
    });
  });

  test("when armor provides no modifier, then no phantom negative zero is produced", () => {
    assert.deepEqual(resolveDefense("dodge", {}), {
      stat: "speed", armorModifier: 0
    });
  });

  test("when armor hinders Speed, then the resulting task steps include that hindrance", () => {
    const defense = resolveDefense("dodge", { dodgeHinder: 2 });
    assert.equal(
      computeTaskSteps({
        extraHinderSteps: Math.abs(defense.armorModifier)
      }),
      -2
    );
  });
});
