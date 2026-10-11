// CRD > Effort / Free Level of Effort; Superheroes Genre > Power Shifts / Superheroics.
import assert from "node:assert/strict";
import test from "node:test";
import { resolveTaskEffort, resolveTaskPowerShifts } from "../../module/rules/task-effort.mjs";

test("Given ordinary free Effort, then paid levels alone consume the score and the first paid level still costs three", () => {
  const result = resolveTaskEffort({ effortScore: 1, effortLevels: 1, freeEffortLevels: 2 });
  assert.equal(result.easingLevels, 3); assert.equal(result.cost, 3);
  assert.equal(resolveTaskEffort({ effortScore: 6, effortLevels: 5, freeEffortLevels: 2 }), null);
});

test("Given Superheroics in the chosen Pool, then rank raises limits and the wound-funded grant consumes the raised score", () => {
  assert.equal(resolveTaskEffort({ effortScore: 6, effortLevels: 7, superheroicsRank: 1 }).easingLevels, 7);
  assert.equal(resolveTaskEffort({ effortScore: 2, effortLevels: 2, superheroicsRank: 1, push: true }), null);
  const result = resolveTaskEffort({ effortScore: 2, effortLevels: 1, superheroicsRank: 1, push: true });
  assert.equal(result.easingLevels, 3); assert.equal(result.cost, 3);
  assert.equal(resolveTaskEffort({ effortScore: 2, push: true }), null);
});

test("Given area damage, then a damage level adds two points instead of three", () => {
  assert.equal(resolveTaskEffort({ effortScore: 2, isAttack: true, damageEffortLevels: 2, areaAttack: true }).damageBonus, 4);
  assert.equal(resolveTaskEffort({ effortScore: 2, isAttack: true, damageEffortLevels: 2 }).damageBonus, 6);
});

test("Given a wound-funded Superheroics grant, then attack levels may be allocated to damage within the same score limit", () => {
  const result = resolveTaskEffort({ effortScore: 2, superheroicsRank: 1, push: true,
    isAttack: true, pushDamageEffortLevels: 2 });
  assert.equal(result.easingLevels, 0);
  assert.equal(result.damageBonus, 6);
  assert.equal(result.cost, 0);
});

test("Given Single Attack plus Strength shifts on a confirmed melee attack, then easing and damage stack independently", () => {
  assert.deepEqual(resolveTaskPowerShifts({ shifts: { singleAttack: 1, strength: 1 }, isAttack: true,
    categories: ["singleAttack", "strength", "strength"] }), { ease: 1, damage: 6 });
  assert.deepEqual(resolveTaskPowerShifts({ shifts: { healing: 2, flight: 3 } }), { ease: 0, damage: 0 });
  assert.equal(resolveTaskPowerShifts({ shifts: { savant: 1 }, isAttack: true, categories: ["savant"] }), null);
});
