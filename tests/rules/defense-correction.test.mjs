/** CRD / Spending Experience Points / Rerolling, 8079–8080: undo only this defense's contribution. */
import assert from "node:assert/strict";
import test from "node:test";
import { planDefenseCorrection } from "../../module/rules/defense-correction.mjs";

const contribution = () => ({ version: 1, state: "applied", success: false,
  wounds: { minor: 0, moderate: 1, major: 0 }, revisions: { minor: 0, moderate: 0, major: 0 }, pool: null });
const wounds = (moderate = 2) => ({ minor: { current: 2 }, moderate: { current: moderate }, major: { current: 1 } });

test("a correction subtracts the actual overflow tier and retains all later wounds", () => {
  assert.deepEqual(planDefenseCorrection({ contribution: contribution(), wounds: wounds(), revisions: {} }),
    { "system.wounds.moderate.current": 1 });
});

test("healing in the affected tier makes attribution ambiguous even if later wounds restored the count", () => {
  assert.equal(planDefenseCorrection({ contribution: contribution(), wounds: wounds(), revisions: { moderate: 1 } }), null);
});

test("healing another tier does not invalidate a known contribution", () => {
  assert.deepEqual(planDefenseCorrection({ contribution: contribution(), wounds: wounds(), revisions: { minor: 1 } }),
    { "system.wounds.moderate.current": 1 });
});

test("missing contributions and insufficient remaining wounds never guess a subtraction", () => {
  assert.equal(planDefenseCorrection({ contribution: null, wounds: wounds(), revisions: {} }), null);
  assert.equal(planDefenseCorrection({ contribution: contribution(), wounds: wounds(0), revisions: {} }), null);
});

test("previously corrected or partially committed defenses cannot be undone again", () => {
  for (const state of ["corrected", "pending", "manual"]) {
    assert.equal(planDefenseCorrection({ contribution: { ...contribution(), state }, wounds: wounds(), revisions: {} }), null);
  }
});

test("Pool restoration preserves later spending and rejects intervening recovery or a smaller capacity", () => {
  const entry = { ...contribution(), pool: { stat: "might", amount: 3, revision: 0 } };
  assert.deepEqual(planDefenseCorrection({ contribution: entry, wounds: wounds(), revisions: {},
    pool: { value: 2, max: 10, revision: 0, path: "system.stats.might.pool.value" } }),
  { "system.wounds.moderate.current": 1, "system.stats.might.pool.value": 5 });
  for (const pool of [{ value: 2, max: 10, revision: 1 }, { value: 2, max: 4, revision: 0 }]) {
    assert.equal(planDefenseCorrection({ contribution: entry, wounds: wounds(), revisions: {}, pool }), null);
  }
});
