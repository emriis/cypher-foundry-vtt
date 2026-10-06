import assert from "node:assert/strict";
import test from "node:test";

import { CRD_STUNSTICK_FIXTURE } from "../fixtures/crd-source-fixtures.mjs";

test("Stunstick source fixture matches the extracted CRD mechanics", () => {
  assert.equal(CRD_STUNSTICK_FIXTURE.type, "attack");
  assert.equal(CRD_STUNSTICK_FIXTURE.crdType, "weapon");
  assert.equal(CRD_STUNSTICK_FIXTURE.system.attackType, "medium");
  assert.equal(CRD_STUNSTICK_FIXTURE.system.damage, 0);
  assert.deepEqual(CRD_STUNSTICK_FIXTURE.system.mechanics.targetEffects, [
    {
      minimumTargetLevel: 0,
      maximumTargetLevel: 2,
      effect: "loseNextAction",
      hinderSteps: 0,
      duration: "next action"
    },
    {
      minimumTargetLevel: 3,
      maximumTargetLevel: null,
      effect: "hindered",
      hinderSteps: 2,
      duration: "a round or two"
    }
  ]);
});

test("Stunstick extraction preserves its source provenance", () => {
  const provenance = CRD_STUNSTICK_FIXTURE.flags.cypherFoundry.crd;
  assert.equal(provenance.version, "2026-07-29");
  assert.equal(provenance.language, "en");
  assert.equal(provenance.logicalId, "weapon.stunstick");
  assert.deepEqual(provenance.transformations, [
    "structural field mapping only"
  ]);
});
