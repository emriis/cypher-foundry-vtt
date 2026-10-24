/** No environmental damage table is inferred from danger names or elapsed time. */
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEnvironmentalProfile, environmentalConsequences, environmentalExposureDue } from "../../module/rules/environment.mjs";

test("an environmental defense requires an explicit stat, difficulty and consequence", () => {
  const profile = normalizeEnvironmentalProfile({ name: "Smoke", mode: "defense", stat: "might", difficulty: 3,
    severity: "moderate", wounds: 1, intervalSeconds: 60 });
  assert.equal(profile?.name, "Smoke");
  assert.equal(profile.stat, "might");
  assert.equal(normalizeEnvironmentalProfile({ name: "Fire", mode: "defense", severity: "minor" }), null);
  assert.equal(normalizeEnvironmentalProfile({ name: "Fall", mode: "immediate" }), null);
});

test("profiles copy only explicit supported data and reject invalid numbers and empty effects", () => {
  const input = { name: "  Falling  ", mode: "immediate", severity: "major", wounds: 2,
    conditions: [{ kind: "prone", steps: 1, id: "forged" }], poolDamage: { stat: "speed", amount: 3 } };
  const saved = normalizeEnvironmentalProfile(input);
  assert.equal(saved.name, "Falling");
  assert.deepEqual(saved.conditions, [{ kind: "prone", steps: 1 }]);
  input.poolDamage.amount = 9;
  assert.equal(saved.poolDamage.amount, 3);
  for (const patch of [{ wounds: 0 }, { wounds: 1.5 }, { intervalSeconds: 0 }, { intervalSeconds: -1 },
    { poolDamage: { stat: "luck", amount: 1 } }, { conditions: [{ kind: "imagined" }] },
    { protection: { woundReduction: 1 } }, { protection: { source: "coat", poolReduction: -1 } }]) {
    assert.equal(normalizeEnvironmentalProfile({ ...input, ...patch }), null);
  }
});

test("only declared protection reduces wounds, Pools or all consequences", () => {
  const base = { name: "Cold", mode: "immediate", severity: "major", poolDamage: { stat: "might", amount: 5 },
    conditions: [{ kind: "hindered", steps: 2 }] };
  const profile = normalizeEnvironmentalProfile({ ...base, protection: { source: "Declared suit", woundReduction: 2, poolReduction: 3 } });
  assert.deepEqual(environmentalConsequences(profile), { severity: "minor", wounds: 1,
    poolDamage: { stat: "might", amount: 2 }, conditions: [{ kind: "hindered", steps: 2 }] });
  const immune = normalizeEnvironmentalProfile({ ...base, protection: { source: "Explicit immunity", immune: true } });
  assert.deepEqual(environmentalConsequences(immune), { severity: null, wounds: 1, poolDamage: null, conditions: [] });
  assert.equal(environmentalConsequences(normalizeEnvironmentalProfile({ ...base, protection: { source: "Suit", woundReduction: 3 } })).severity, null);
});

test("repetition requires a fresh sequence and elapsed game time or explicit passage", () => {
  const entry = { version: 1, state: "ready", sequence: 1, nextAt: 100 };
  assert.equal(environmentalExposureDue(entry, 1, 99), false);
  assert.equal(environmentalExposureDue(entry, 1, 100), true);
  assert.equal(environmentalExposureDue(entry, 0, 200, true), false);
  assert.equal(environmentalExposureDue(entry, 1, undefined, true), true);
  assert.equal(environmentalExposureDue({ ...entry, state: "processing" }, 1, 200, true), false);
  assert.equal(environmentalExposureDue({ ...entry, sequence: 0, nextAt: null }, 0, undefined), true);
});
