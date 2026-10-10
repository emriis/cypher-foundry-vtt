// CRD > Special Rolls: 19/20 on damaging attacks offer damage or an effect.
import assert from "node:assert/strict";
import test from "node:test";
import { resolveTaskOutcome } from "../../module/rules/task-outcome.mjs";
import { resolveRerollPlan, selectRerollValue } from "../../module/rules/rerolls.mjs";

test("natural 19/20 attack outcomes preserve the explicit damage/effect choice", () => {
  for (const [d20, damage, effect] of [[19, 3, "minor"], [20, 4, "major"]]) {
    const context = { d20, effectiveDifficulty: 1, isAttack: true, baseDamage: 4 };
    assert.equal(resolveTaskOutcome({ ...context, specialEffectChoice: "damage" }).totalDamage, 4 + damage);
    const selected = resolveTaskOutcome({ ...context, specialEffectChoice: effect });
    assert.equal(selected.totalDamage, 4);
    assert.equal(selected.selectedEffect, effect);
    assert.equal(resolveTaskOutcome(context).damageBonus, 0, "an unresolved choice does not invent extra damage");
  }
});

test("legacy depletion metadata resolves its original inclusive range", () => {
  const plan = resolveRerollPlan({ rollType: "depletion", dieMax: 6, threshold: 2, originalRoll: 1 });
  assert.equal(selectRerollValue(plan, 5), 5);
  assert.equal(resolveRerollPlan({ rollType: "depletion", dieMax: 6, threshold: 10, originalRoll: 1 }), null);
});
