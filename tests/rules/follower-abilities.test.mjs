import assert from "node:assert/strict";
import test from "node:test";
import { followerAbilityPlan } from "../../module/rules/follower-abilities.mjs";

test("permanent grants have source-defined quantities and task profiles", () => {
  assert.deepEqual(followerAbilityPlan("automaton-fleet").grants, [{ family: "automaton", level: 2, count: 4 }]);
  assert.deepEqual(followerAbilityPlan("basic-follower").grants, [{ family: "follower", level: 2, count: 1, tasks: 2, taskLevel: 3, charm: true }]);
  assert.equal(followerAbilityPlan("basic-necromancy"), null);
  assert.equal(followerAbilityPlan("expert-follower", "other"), null);
});

test("alternative grants preserve their source-defined replacement and upgrade choices", () => {
  const plan = followerAbilityPlan("expert-automaton", "upgrade");
  assert.deepEqual(plan.grants, [{ family: "automaton", level: 2, count: 1 }]);
  assert.deepEqual(plan.upgrade, { families: ["automaton"], levels: [2, 3], add: 1, count: 1 });
  assert.equal(followerAbilityPlan("band-of-followers", "upgrade").upgrade.count, 4);
  assert.equal(followerAbilityPlan("improved-machine-companion", "upgrade").grants.length, 0);
  assert.equal(followerAbilityPlan("improved-companion").limit, 3);
  assert.equal(followerAbilityPlan("improved-follower").oncePerTier, true);
});
