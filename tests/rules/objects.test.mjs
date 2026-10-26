/** Source examples and accepted separation of breaking and destruction. */
import assert from "node:assert/strict";
import test from "node:test";
import { objectState, resolveObjectDamage } from "../../module/rules/objects.mjs";
const object = (level = 6) => ({ originalLevel: level, levelDamage: 0, destructionDamage: 0, physical: true, material: "steel" });
const tool = { usesPhysicalTool: true, toolHardEnough: true, cutLevel: null, armorBypass: 0 };
test("the CRD seven-damage attacks reduce a steel door from six to five, three and zero", () => {
  let state = object();
  for (const level of [5, 3, 0]) { state = resolveObjectDamage(state, 7, tool).system; assert.equal(objectState(state).level, level); }
  assert.equal(state.destructionDamage, 0);
  assert.equal(objectState(state).status, "broken");
  state = resolveObjectDamage(state, 3, tool).system;
  assert.equal(objectState(state).status, "broken");
  state = resolveObjectDamage(state, 3, tool).system;
  assert.equal(objectState(state).status, "destroyed");
});
test("a massive breaking hit cannot destroy the same object; only later hits count", () => {
  const broken = resolveObjectDamage(object(2), 100, tool).system;
  assert.equal(objectState(broken).status, "broken"); assert.equal(broken.destructionDamage, 0);
  assert.equal(objectState(resolveObjectDamage(broken, 2, tool).system).status, "destroyed");
});
test("a softer tool has no effect; a qualifying physical material cutter ignores object protection", () => {
  assert.equal(resolveObjectDamage(object(), 8, { ...tool, toolHardEnough: false }).appliedDamage, 0);
  const cut = resolveObjectDamage(object(), 3, { ...tool, toolHardEnough: false, cutLevel: 6 });
  assert.equal(objectState(cut.system).level, 3);
  assert.equal(cut.armor, 0);
  assert.equal(resolveObjectDamage(object(7), 3, { ...tool, toolHardEnough: false, cutLevel: 6 }).appliedDamage, 0);
  assert.equal(resolveObjectDamage({ ...object(), physical: false }, 3, { ...tool, cutLevel: 6 }).appliedDamage, 0);
});
test("invalid state, damage and a destroyed object are rejected without invented Health or wounds", () => {
  for (const value of [-1, NaN, 1.5, Infinity]) assert.equal(resolveObjectDamage(object(), value, tool), null);
  assert.equal(objectState({ ...object(), destructionDamage: 1 }), null);
  assert.equal(objectState({ ...object(), levelDamage: 7 }), null);
  assert.equal(resolveObjectDamage({ ...object(), levelDamage: 6, destructionDamage: 6 }, 1, tool), null);
});
