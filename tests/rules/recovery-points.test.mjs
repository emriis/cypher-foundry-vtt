import assert from "node:assert/strict";
import test from "node:test";
import { defaultRecoveryAllocation, recoveryPoolUpdates } from "../../module/rules/recovery-points.mjs";
import { recoverySources } from "../../module/rules/recovery-sources.mjs";

const pools = { might: { value: 6, max: 8 }, speed: { value: 2, max: 8 }, intellect: { value: 8, max: 8 } };

test("Given recovery points, then allocation honors the total, capacities, integers and named Pools", () => {
  assert.deepEqual(recoveryPoolUpdates(5, pools, { might: 2, speed: 3 }), {
    "system.stats.might.pool.value": 8, "system.stats.speed.pool.value": 5
  });
  for (const allocation of [{ might: 3 }, { speed: 6 }, { intellect: 1 }, { speed: -1 }, { speed: 0.5 }, { mana: 1 }, null]) {
    assert.equal(recoveryPoolUpdates(5, pools, allocation), null);
  }
  assert.deepEqual(defaultRecoveryAllocation(5, pools), { might: 2, speed: 3, intellect: 0 });
});

test("Given Healing power shifts, then each shift adds an independently tracked one-action recovery", () => {
  const sources = recoverySources({ genre: "superhero", powerShifts: { healing: 2 }, recoveries: { action: true } }, [],
    { additionalRecoveriesUsed: { "power-shift-healing": 1 } }, "action");
  assert.equal(sources[0].remaining, 0);
  assert.equal(sources[1].remaining, 1);
});
