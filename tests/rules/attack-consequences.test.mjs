/** CRD / Special Rolls and Rerolling: replace the attack's actual contribution. */
import assert from "node:assert/strict";
import test from "node:test";
import { planAttackDamage } from "../../module/rules/attack-consequences.mjs";

const history = (damage, bands, revision = 0) => ({ resolvedDamage: damage, damageBands: bands, healthRevision: revision });
test("an improved attack applies only additional damage to current Health", () => {
  assert.deepEqual(planAttackDamage(history(4, [{ from: 0, to: 4 }]), 6, 7, 20, 0), {
    health: 5, resolvedDamage: 6, damageBands: [{ from: 0, to: 4 }, { from: 4, to: 6 }], healthRevision: 0
  });
});
test("choosing a major effect restores only the attack's own damage, including overkill", () => {
  const result = planAttackDamage(history(6, [{ from: 0, to: 3 }]), 2, 0, 20, 0);
  assert.equal(result.health, 1);
  assert.deepEqual(result.damageBands, [{ from: 0, to: 2 }]);
});
test("unapplied bonus damage is never refunded as base damage", () => {
  const result = planAttackDamage(history(6, [{ from: 0, to: 2 }]), 2, 0, 20, 0);
  assert.equal(result.health, 0);
});
test("healing invalidates attribution, while unchanged damage requires no correction", () => {
  assert.equal(planAttackDamage(history(4, [{ from: 0, to: 4 }]), 6, 10, 20, 1), null);
  assert.equal(planAttackDamage(history(4, [{ from: 0, to: 4 }]), 4, 10, 20, 1)?.health, 10);
});
test("malformed, overlapping contributions or an excessive restoration require adjudication", () => {
  assert.equal(planAttackDamage(history(4, [{ from: 0, to: 5 }]), 6, 10, 20, 0), null);
  assert.equal(planAttackDamage(history(4, [{ from: 0, to: 3 }, { from: 2, to: 4 }]), 6, 10, 20, 0), null);
  assert.equal(planAttackDamage(history(4, [{ from: 0, to: 4 }]), 2, 19, 20, 0), null);
});
