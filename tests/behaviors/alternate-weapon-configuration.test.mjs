import assert from "node:assert/strict";
import test from "node:test";

import { resolveWeaponConfiguration } from "../../module/rules/weapon-mechanics.mjs";

test("Given a weapon with a CRD-defined alternate category, when the alternate configuration is active, then its category determines damage", () => {
  const result = resolveWeaponConfiguration({
    attackType: "heavy",
    damage: 6,
    mechanics: {
      activeConfiguration: "alternate",
      alternateConfiguration: { enabled: true, attackType: "medium", action: "action" }
    }
  });

  assert.equal(result.configuration, "alternate");
  assert.equal(result.attackType, "medium");
  assert.equal(result.baseDamage, 4);
});

test("Given a weapon whose alternate configuration is inactive, when an attack is prepared, then primary source damage remains unchanged", () => {
  const result = resolveWeaponConfiguration({
    attackType: "heavy",
    damage: 5,
    mechanics: {
      activeConfiguration: "primary",
      alternateConfiguration: { enabled: true, attackType: "medium", action: "action" }
    }
  });

  assert.equal(result.configuration, "primary");
  assert.equal(result.attackType, "heavy");
  assert.equal(result.baseDamage, 5);
});
