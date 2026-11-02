import assert from "node:assert/strict";
import test from "node:test";
import { protectionPlan, protectionEnergy, elementalReduction, protectionRecoveryUpdates } from "../../module/rules/protection-powers.mjs";
test("protective activation costs, recovery intervals and dedicated Effort are source-bound", () => {
  assert.equal(protectionPlan("mage-armor")?.cost, 1);
  assert.equal(protectionPlan("mage-armor")?.recovery, "tenHours");
  assert.equal(protectionPlan("armoring-debris")?.cost, 5);
  assert.equal(protectionPlan("elemental-protection", 2)?.steps, 3);
  assert.equal(protectionPlan("elemental-protection", 3), null);
  assert.equal(protectionPlan("mage-armor", 1), null);
});
test("energy is declared explicitly; existing tags resolve aliases and mixed energies require adjudication", () => {
  assert.equal(protectionEnergy(" Lightning "), "lightning");
  assert.equal(protectionEnergy("", ["heat", "fire"]), "fire");
  assert.equal(protectionEnergy("", ["cold", "fire"]), null);
  assert.equal(protectionEnergy("", ["falling"]), "");
});
test("exact energy bonuses deduplicate and distinct magnitudes apply within the severity limit", () => {
  const effect = steps => ({ key: "elemental-protection", energy: "fire", steps });
  assert.equal(elementalReduction([effect(1), effect(1)], "fire"), 1);
  assert.equal(elementalReduction([effect(1), effect(2)], "fire"), 3);
  assert.equal(elementalReduction([effect(3)], "cold"), 0);
});
test("only completed recipient recovery intervals advance the corresponding protection epochs", () => {
  assert.deepEqual(protectionRecoveryUpdates({}, "action"), {});
  assert.deepEqual(protectionRecoveryUpdates({ protectionRecoveries: { hour: 2 } }, "hour"), {
    "flags.cypher.protectionRecoveries.tenMinutes": 1, "flags.cypher.protectionRecoveries.hour": 3
  });
});
