import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAbilityCost,
  resolveAbilityCostStat
} from "../../module/rules/ability-costs.mjs";

test("fixed Ability costs resolve their source-defined stat", () => {
  const cost = { stat: "might", amount: 3, options: [] };
  assert.equal(resolveAbilityCostStat(cost), "might");
  assert.deepEqual(
    resolveAbilityCost({
      stats: {
        might: { pool: { value: 5, max: 8 }, edge: 0 },
        speed: { pool: { value: 8, max: 8 }, edge: 0 },
        intellect: { pool: { value: 8, max: 8 }, edge: 0 }
      },
      customStats: []
    }, cost),
    { stat: "might", amount: 3, path: "system.stats.might.pool.value" }
  );
});

test("choice Ability costs require one of their source-defined options", () => {
  const cost = {
    stat: "choice",
    amount: 2,
    options: ["might", "speed"]
  };
  assert.equal(resolveAbilityCostStat(cost), null);
  assert.equal(resolveAbilityCostStat(cost, "intellect"), null);
  assert.equal(resolveAbilityCostStat(cost, "speed"), "speed");
});

test("Ability costs cannot be resolved when the selected Pool is insufficient", () => {
  const cost = { stat: "might", amount: 3, options: [] };
  const system = {
    stats: {
      might: { pool: { value: 2, max: 8 }, edge: 0 },
      speed: { pool: { value: 8, max: 8 }, edge: 0 },
      intellect: { pool: { value: 8, max: 8 }, edge: 0 }
    },
    customStats: []
  };
  assert.equal(resolveAbilityCost(system, cost), null);
});
