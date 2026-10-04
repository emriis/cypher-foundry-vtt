import assert from "node:assert/strict";
import test from "node:test";

const { resolveStat } = await import("../../module/rules/stats.mjs");

test("resolveStat resolves core stats to their data and update path", () => {
  const system = {
    stats: {
      might: { pool: { value: 8, max: 8 }, edge: 1 },
      speed: { pool: { value: 6, max: 8 }, edge: 0 },
      intellect: { pool: { value: 4, max: 8 }, edge: 0 }
    },
    customStats: []
  };

  assert.deepEqual(resolveStat(system, "might"), {
    data: system.stats.might,
    path: "system.stats.might",
    label: "CYPHER.Stat.might"
  });
});

test("resolveStat resolves custom stats by id and preserves their label", () => {
  const customStat = {
    id: "willpower",
    label: "Willpower",
    pool: { value: 7, max: 8 },
    edge: 0
  };
  const system = {
    stats: {},
    customStats: [customStat]
  };

  assert.deepEqual(resolveStat(system, "willpower"), {
    data: customStat,
    path: "system.customStats.0",
    label: "Willpower"
  });
});

test("resolveStat returns null for an unknown stat", () => {
  assert.equal(resolveStat({ stats: {}, customStats: [] }, "unknown"), null);
});
