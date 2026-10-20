/** CRD Ability Effort 630–632 and Edge 7552–7553. */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveTaskEffort } from "../../module/rules/task-effort.mjs";

test("shield effect Effort consumes a separate level and shares Edge with activation", () => {
  const plan = resolveTaskEffort({ effortLevels: 1, effectEffortLevels: 1, activationCost: 3,
    effortScore: 2, isAttack: true, edge: 2 });
  assert.equal(plan.cost, 6); // 3 activation + 5 for two levels - 2 Edge.
  assert.equal(plan.easingLevels, 1);
  assert.equal(plan.damageBonus, 0);
  assert.equal(plan.paidLevels, 2);
  assert.equal(resolveTaskEffort({ effectEffortLevels: 1, effortScore: 0, isAttack: true }), null);
  assert.equal(resolveTaskEffort({ effectEffortLevels: 1, effortScore: 2, isAttack: false }), null);
});
