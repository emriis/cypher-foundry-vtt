import assert from "node:assert/strict";
import test from "node:test";

import { resolveDefense } from "../../module/rules/defense.mjs";

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
