import assert from "node:assert/strict";
import test from "node:test";
import { companionBonuses, retainerHealthDamage } from "../../module/rules/companion-powers.mjs";
test("companion benefits require declared circumstances and preserve the mount movement exception", () => {
  assert.deepEqual(companionBonuses({ ready: false, stronger: true, immediate: true }, { isAttack: true }), { assets: 0, damage: 0, recovery: 0, mounted: false });
  assert.equal(companionBonuses({ ready: true, immediate: true, stronger: true }, { isDefense: true }).assets, 1);
  assert.equal(companionBonuses({ ready: true, immediate: true, stronger: true }, { isAttack: true }).damage, 2);
  assert.equal(companionBonuses({ ready: true, immediate: true, betterment: true, calmed: true }).recovery, 0);
  assert.equal(companionBonuses({ ready: true, immediate: true, betterment: true, family: "beast" }).recovery, 3);
  assert.equal(companionBonuses({ ready: true, riding: true, mount: true, family: "mount" }, { isAttack: true }).mounted, true);
});
test("retainer damage uses explicitly declared Health damage and actual NPC armor", () => {
  assert.equal(retainerHealthDamage(6, 3, 1), 4);
  assert.equal(retainerHealthDamage("major", 0), null);
});
