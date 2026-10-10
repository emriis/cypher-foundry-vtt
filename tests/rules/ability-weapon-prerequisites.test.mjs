import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWeaponPrerequisites
} from "../../module/rules/ability-weapon-prerequisites.mjs";

const spray = [
  { kind: "rapidFire", alternativeGroup: "weapon-use", value: "" },
  { kind: "thrownWeaponsInReach", alternativeGroup: "weapon-use", value: "" }
];

const arcSpray = [
  { kind: "rapidFire", alternativeGroup: "weapon-use", value: "" }
];

test("Spray accepts a rapid-fire weapon", () => {
  assert.deepEqual(resolveWeaponPrerequisites(spray, {
    weapon: { mechanics: { rapidFire: true } }
  }), { eligible: true, unmetGroups: [] });
});

test("Spray accepts multiple thrown weapons explicitly declared within reach", () => {
  assert.deepEqual(resolveWeaponPrerequisites(spray, {
    thrownWeaponsInReach: true
  }), { eligible: true, unmetGroups: [] });
});

test("Spray is ineligible when neither CRD alternative is established", () => {
  assert.deepEqual(resolveWeaponPrerequisites(spray, {
    weapon: { mechanics: { rapidFire: false } },
    thrownWeaponsInReach: false
  }), { eligible: false, unmetGroups: ["weapon-use"] });
});

test("Arc Spray requires rapid fire and does not inherit Spray's thrown-weapon alternative", () => {
  assert.equal(resolveWeaponPrerequisites(arcSpray, {
    thrownWeaponsInReach: true
  }).eligible, false);
  assert.equal(resolveWeaponPrerequisites(arcSpray, {
    weapon: { mechanics: { rapidFire: true } }
  }).eligible, true);
});

test("independent prerequisite groups are cumulative, alternatives within a group are OR", () => {
  const prerequisites = [
    ...spray,
    { kind: "weaponCategory", alternativeGroup: "category", value: "heavy" }
  ];
  assert.equal(resolveWeaponPrerequisites(prerequisites, {
    weapon: { mechanics: { rapidFire: true }, attackType: "light" }
  }).eligible, false);
  assert.equal(resolveWeaponPrerequisites(prerequisites, {
    weapon: { mechanics: { rapidFire: true }, attackType: "heavy" }
  }).eligible, true);
});

test("empty prerequisites are satisfied and malformed groups fail closed", () => {
  assert.deepEqual(resolveWeaponPrerequisites([]), {
    eligible: true, unmetGroups: []
  });
  assert.equal(resolveWeaponPrerequisites([{ kind: "rapidFire" }]).eligible, false);
});

test("weapon prerequisites do not infer rapid fire from descriptive text or names", () => {
  assert.equal(resolveWeaponPrerequisites(arcSpray, {
    weapon: { name: "Rapid-fire rifle", properties: ["rapid-fire"] }
  }).eligible, false);
});
