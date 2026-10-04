// Covers deterministic legacy actor schema transformations.
import assert from "node:assert/strict";
import test from "node:test";

const { buildLegacyFreeUseUpdates } = await import("../../module/migrations/actor-schema-migrations.mjs");

test("buildLegacyFreeUseUpdates is deterministic and does not mutate actor data", () => {
  const actor = {
    type: "pc",
    system: {
      genre: "fantasy",
      type: "Barbare",
      canFreelyUseAllWeapons: true,
      canFreelyUseAllArmor: true,
      advancementSlots: []
    }
  };
  const before = structuredClone(actor);
  const updates = buildLegacyFreeUseUpdates(actor);

  assert.deepEqual(updates["system.freeWeaponCategories"], [
    "light",
    "medium",
    "heavy"
  ]);
  assert.deepEqual(updates["system.freeArmorCategories"], ["light", "medium"]);
  assert.deepEqual(actor, before);
});

test("buildLegacyFreeUseUpdates preserves explicit all-category advancements", () => {
  const actor = {
    type: "pc",
    system: {
      genre: "fantasy",
      type: "Mage",
      canFreelyUseAllWeapons: true,
      canFreelyUseAllArmor: true,
      advancementSlots: [
        { type: "other", otherType: "armor", bought: true }
      ]
    }
  };
  const updates = buildLegacyFreeUseUpdates(actor);

  assert.deepEqual(updates["system.freeArmorCategories"], [
    "light",
    "medium",
    "heavy"
  ]);
});
