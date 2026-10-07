import assert from "node:assert/strict";
import test from "node:test";

import { resolveWeaponSkillModifier } from "../../module/rules/weapon-skills.mjs";

test("Scenario: an unfamiliar weapon with a trained attack skill is practiced", () => {
  const given = {
    familiar: false,
    skillLevel: "trained"
  };

  const when = resolveWeaponSkillModifier(given);

  assert.equal(when, 0);
});

test("Scenario: an unfamiliar weapon with a specialized attack skill keeps one ease", () => {
  const given = {
    familiar: false,
    skillLevel: "specialized"
  };

  const when = resolveWeaponSkillModifier(given);

  assert.equal(when, 1);
});

test("Scenario: an explicit inability does not stack with weapon unfamiliarity", () => {
  const given = {
    familiar: false,
    skillLevel: "inability"
  };

  const when = resolveWeaponSkillModifier(given);

  assert.equal(when, -1);
});

test("Scenario: a familiar weapon still benefits from trained skill", () => {
  const given = {
    familiar: true,
    skillLevel: "trained"
  };

  const when = resolveWeaponSkillModifier(given);

  assert.equal(when, 1);
});
