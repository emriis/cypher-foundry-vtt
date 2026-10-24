import assert from "node:assert/strict";
import test from "node:test";
import { minimumWeaponHands, handsFit } from "../../module/rules/equipment-hands.mjs";

test("heavy weapons require two hands, with only the explicit one-handed exception", () => {
  assert.equal(minimumWeaponHands({ attackType: "heavy", mechanics: {} }), 2);
  assert.equal(minimumWeaponHands({ attackType: "heavy", mechanics: { hinderedWhenUsedOneHanded: true } }), 1);
  assert.equal(minimumWeaponHands({ attackType: "medium", mechanics: { twoHanded: true } }), 2);
});

test("capacity sums actual simultaneous grips and rejects malformed units", () => {
  assert.equal(handsFit(2, [1, 1]), true);
  assert.equal(handsFit(2, [2, 1]), false);
  assert.equal(handsFit(0, [0]), true);
  assert.equal(handsFit(3, [2, 1]), true);
  assert.equal(handsFit(2, [-1]), false);
  assert.equal(handsFit(2, [1.5]), false);
  assert.equal(handsFit(-1, []), false);
});
