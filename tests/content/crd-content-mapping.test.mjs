import assert from "node:assert/strict";
import test from "node:test";

import {
  CRD_FOUNDRY_MAPPING,
  getCrdFoundryMapping,
  CRD_MECHANICAL_FIELDS
} from "../../module/crd/content-mapping.mjs";

test("maps reusable CRD content to the existing Foundry document models", () => {
  assert.deepEqual(CRD_FOUNDRY_MAPPING.ability, {
    document: "Item",
    type: "ability"
  });
  assert.deepEqual(CRD_FOUNDRY_MAPPING.weapon, {
    document: "Item",
    type: "attack"
  });
  assert.deepEqual(CRD_FOUNDRY_MAPPING.creature, {
    document: "Actor",
    type: "npc"
  });
});

test("maps rules and genres to Journal Entries", () => {
  assert.deepEqual(getCrdFoundryMapping("journal"), {
    document: "JournalEntry",
    type: null
  });
  assert.deepEqual(getCrdFoundryMapping("genre"), {
    document: "JournalEntry",
    type: null
  });
});

test("does not invent a Foundry model for unsupported CRD content", () => {
  assert.equal(getCrdFoundryMapping("unknown"), undefined);
});


test("keeps high-value CRD mechanics in structured fields", () => {
  assert.ok(CRD_MECHANICAL_FIELDS.ability.includes("cost"));
  assert.ok(CRD_MECHANICAL_FIELDS.ability.includes("effects"));
  assert.ok(CRD_MECHANICAL_FIELDS.type.includes("abilityTiers"));
  assert.ok(CRD_MECHANICAL_FIELDS.weapon.includes("range"));
  assert.ok(CRD_MECHANICAL_FIELDS.weapon.includes("properties"));
  assert.ok(CRD_MECHANICAL_FIELDS.equipment.includes("level"));
  assert.ok(CRD_MECHANICAL_FIELDS.equipment.includes("priceCategory"));
  assert.ok(CRD_MECHANICAL_FIELDS.cypher.includes("powerLevel"));
  assert.ok(CRD_MECHANICAL_FIELDS.artifact.includes("depletionDie"));
});
