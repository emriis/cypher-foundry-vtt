import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveArcSprayAttacks,
  resolveSprayUse
} from "../../module/rules/weapon-ability-resolution.mjs";

test("Spray requests one more use than the d6 result", () => {
  for (let dieResult = 1; dieResult <= 6; dieResult += 1) {
    const result = resolveSprayUse({ dieResult });
    assert.equal(result.eligible, true);
    assert.equal(result.requestedUses, dieResult + 1);
    assert.equal(result.usesToConsume, dieResult + 1);
    assert.equal(result.assetSteps, 1);
    assert.equal(result.damageAdjustment, -1);
    assert.equal(result.reason, null);
  }
});

test("Spray caps consumed uses at the available store", () => {
  assert.deepEqual(resolveSprayUse({
    dieResult: 6,
    availableUses: 3
  }), {
    eligible: true,
    requestedUses: 7,
    usesToConsume: 3,
    assetSteps: 1,
    damageAdjustment: -1,
    reason: null
  });
});

test("Spray rejects an empty store without granting attack benefits", () => {
  assert.deepEqual(resolveSprayUse({
    dieResult: 4,
    availableUses: 0
  }), {
    eligible: false,
    requestedUses: 5,
    usesToConsume: 0,
    assetSteps: 0,
    damageAdjustment: 0,
    reason: "no-available-uses"
  });
});

test("Spray rejects invalid die results and invalid store counts", () => {
  assert.equal(resolveSprayUse({ dieResult: 0 }).eligible, false);
  assert.equal(resolveSprayUse({ dieResult: 7 }).eligible, false);
  assert.equal(resolveSprayUse({ dieResult: 2.5 }).eligible, false);
  assert.equal(resolveSprayUse({
    dieResult: 2,
    availableUses: -1
  }).reason, "invalid-available-uses");
  assert.equal(resolveSprayUse({
    dieResult: 2,
    availableUses: 1.5
  }).reason, "invalid-available-uses");
});

test("Arc Spray creates three separately hindered attacks for confirmed adjacent targets", () => {
  assert.deepEqual(resolveArcSprayAttacks({
    targetIds: ["target-a", "target-b", "target-c"],
    allAdjacent: true
  }), {
    eligible: true,
    attacks: [
      { targetId: "target-a", extraHinderSteps: 1 },
      { targetId: "target-b", extraHinderSteps: 1 },
      { targetId: "target-c", extraHinderSteps: 1 }
    ],
    reason: null
  });
});

test("Arc Spray requires exactly three distinct targets", () => {
  assert.equal(resolveArcSprayAttacks({
    targetIds: ["target-a", "target-b"],
    allAdjacent: true
  }).reason, "requires-three-distinct-targets");
  assert.equal(resolveArcSprayAttacks({
    targetIds: ["target-a", "target-a", "target-c"],
    allAdjacent: true
  }).reason, "requires-three-distinct-targets");
  assert.equal(resolveArcSprayAttacks({
    targetIds: ["target-a", "", "target-c"],
    allAdjacent: true
  }).reason, "requires-three-distinct-targets");
});

test("Arc Spray requires explicit adjacency confirmation", () => {
  assert.deepEqual(resolveArcSprayAttacks({
    targetIds: ["target-a", "target-b", "target-c"]
  }), {
    eligible: false,
    attacks: [],
    reason: "targets-not-confirmed-adjacent"
  });
});
