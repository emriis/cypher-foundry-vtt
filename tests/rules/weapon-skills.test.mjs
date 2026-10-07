import assert from "node:assert/strict";
import test from "node:test";

import { resolveWeaponSkillModifier } from "../../module/rules/weapon-skills.mjs";

test("unfamiliar weapon creates one hindrance without an attack skill", () => {
  assert.equal(resolveWeaponSkillModifier({
    familiar: false
  }), -1);
});

test("familiar weapon has no proficiency modifier without an attack skill", () => {
  assert.equal(resolveWeaponSkillModifier({
    familiar: true
  }), 0);
});

test("practiced attack skill cancels unfamiliar weapon hindrance", () => {
  assert.equal(resolveWeaponSkillModifier({
    familiar: false,
    skillLevel: "practiced"
  }), 0);
});

test("trained attack skill cancels unfamiliar weapon hindrance without adding an ease", () => {
  assert.equal(resolveWeaponSkillModifier({
    familiar: false,
    skillLevel: "trained"
  }), 0);
});

test("specialized attack skill leaves one ease after unfamiliar weapon hindrance", () => {
  assert.equal(resolveWeaponSkillModifier({
    familiar: false,
    skillLevel: "specialized"
  }), 1);
});

test("expert attack skill leaves two eases after unfamiliar weapon hindrance", () => {
  assert.equal(resolveWeaponSkillModifier({
    familiar: false,
    skillLevel: "expert"
  }), 2);
});

test("training levels apply normally when the weapon is already familiar", () => {
  assert.equal(resolveWeaponSkillModifier({
    familiar: true,
    skillLevel: "trained"
  }), 1);
  assert.equal(resolveWeaponSkillModifier({
    familiar: true,
    skillLevel: "specialized"
  }), 2);
});

test("an explicit inability never double-counts the unfamiliar weapon penalty", () => {
  assert.equal(resolveWeaponSkillModifier({
    familiar: false,
    skillLevel: "inability"
  }), -1);
});
