import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveAbilityCost } from "../../module/rules/ability-costs.mjs";

const system = {
  stats: {
    might: { pool: { value: 5, max: 5 }, edge: 1 },
    intellect: { pool: { value: 2, max: 2 }, edge: 0 }
  }
};

describe("Given a character activates an Ability with a Pool cost", () => {
  test("when the chosen stat has enough Pool, then the cost resolves to that Pool path", () => {
    assert.deepEqual(
      resolveAbilityCost(
        system,
        { amount: 2, stat: "intellect" }
      ),
      {
        stat: "intellect",
        amount: 2,
        path: "system.stats.intellect.pool.value"
      }
    );
  });

  test("when the selected choice stat lacks enough Pool, then the cost cannot be paid", () => {
    assert.equal(
      resolveAbilityCost(
        system,
        { amount: 3, stat: "choice", options: ["might", "intellect"] },
        "intellect"
      ),
      null
    );
  });

  test("when a zero-cost Ability is activated, then no Pool is required", () => {
    assert.deepEqual(
      resolveAbilityCost(system, { amount: 0, stat: "might" }),
      { stat: null, amount: 0, path: null }
    );
  });
});
