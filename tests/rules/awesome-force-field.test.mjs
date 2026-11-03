import assert from "node:assert/strict";
import test from "node:test";
import { shatterCost, barrierEffort } from "../../module/rules/awesome-force-field.mjs";
import { resolveTaskEffort } from "../../module/rules/task-effort.mjs";
test("shattering uses only the action's remaining Edge and the retained natural-20 exception", () => {
  assert.equal(shatterCost(2, false), 3);
  assert.equal(shatterCost(0, false), 5);
  assert.equal(shatterCost(0, true), 0);
});

test("remote field counts reserve dedicated levels and the first capture pays only incremental Effort", () => {
  assert.deepEqual([0, 1, 2].map(barrierEffort), [1, 2, 3]);
  assert.equal(barrierEffort(-1), null); assert.equal(barrierEffort(1.5), null);
  const attack = resolveTaskEffort({ effortScore: 2, previousPaidLevels: 1, effortLevels: 1, edge: 1 });
  assert.equal(attack.cost, 1); assert.equal(attack.easingLevels, 1);
  assert.equal(resolveTaskEffort({ effortScore: 1, previousPaidLevels: 1, effortLevels: 1 }), null);
});
