import assert from "node:assert/strict";
import test from "node:test";

globalThis.game = {
  i18n: {
    localize: key => key,
    format: (key, data) => `${key}:${data.name ?? data.type ?? data.count ?? ""}`
  }
};

const {
  buildActorData,
  extractFreelyUsableCategories,
  extractSpeciesAsDescriptor,
  mapItems
} = await import("../module/import.mjs");

test("extractFreelyUsableCategories separates weapon and armor permissions", () => {
  const result = extractFreelyUsableCategories([
    { type: "skill", name: "Freely Use Light and Medium Weapons" },
    { type: "skill", name: "Freely Use All Armor" },
    { type: "skill", name: "Initiative" }
  ]);

  assert.deepEqual([...result.weaponCats].sort(), ["light", "medium"]);
  assert.deepEqual([...result.armorCats].sort(), ["heavy", "light", "medium"]);
});

test("extractSpeciesAsDescriptor maps the Builder species grant", () => {
  assert.equal(extractSpeciesAsDescriptor([
    { system: { description: "Granted from Species: Elf" } }
  ]), "Elf");
  assert.equal(extractSpeciesAsDescriptor([]), null);
});

test("buildActorData creates a custom PC and maps pools and wounds", () => {
  const actor = buildActorData({
    name: "  Ada  ",
    system: {
      basic: { descriptor: "Clever", type: "Delve", focus: "Explores", tier: 2, effort: 3, xp: 4 },
      pools: { might: { value: 10, max: 12, edge: 2 } },
      notes: "Minor: 1/3; Moderate: 0/3; Major: 0/3"
    },
    items: []
  });

  assert.equal(actor.name, "Ada");
  assert.equal(actor.type, "pc");
  assert.equal(actor.system.genre, "custom");
  assert.deepEqual(actor.system.stats.might, { pool: { value: 10, max: 12 }, edge: 2 });
  assert.deepEqual(actor.system.wounds.minor, { current: 1, max: 3 });
});

test("mapItems maps supported items and reports unsupported types", () => {
  const result = mapItems([
    { type: "skill", name: "Stealth", system: { basic: { rating: "specialized" }, description: "Quiet" } },
    { type: "ability", name: "Trick", system: { basic: { pool: "might", cost: "1+" }, description: "Granted from Type: Delve" } },
    { type: "attack", name: "Bow", system: { basic: { type: "light", damage: 2 }, settings: { rollButton: { pool: "speed" } }, description: "Ranged" } },
    { type: "unknown", name: "Mystery", system: {} }
  ], { weaponCats: new Set(["light"]), armorCats: new Set() });

  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].system.level, "specialized");
  assert.deepEqual(result.items[1].system.cost, { stat: "might", amount: 1 });
  assert.equal(result.items[2].system.stat, "speed");
  assert.equal(result.items[2].system.freelyUsable, true);
  assert.equal(result.warnings.length, 1);
});