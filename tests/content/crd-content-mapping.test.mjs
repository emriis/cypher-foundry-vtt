import assert from "node:assert/strict";
import test from "node:test";

import {
  CRD_FOUNDRY_MAPPING,
  getCrdFoundryMapping
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
