/** CRD 2026-07-29: named character entries and equipment tables, on actual authored records. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const record = async file => JSON.parse(await readFile(path.join(root, "packs", file), "utf8"));

test("Frenzy retains its cost, enabling action and additional Effort instruction", async () => {
  const { system } = await record("abilities-en/_source/792ca65e9063dd3d.json");
  assert.equal(system.tier, 1);
  assert.equal(system.cost.stat, "intellect");
  assert.equal(system.cost.amount, 1);
  assert.equal(system.enabler, true);
  assert.equal(system.action, null);
  assert.match(system.description, /Effort: Ease your allies’ attacks/);
});

test("Barbarian retains its starting Pools, wounds and free weapon and armor categories", async () => {
  const { system } = await record("types-en/_source/barbarian.json");
  assert.deepEqual(system.poolBonuses, { might: 3, speed: 1, intellect: 0 });
  assert.deepEqual(system.woundBonuses, { minor: 3, moderate: 1, major: 0 });
  assert.equal(system.edgeChoice, 1);
  assert.deepEqual(system.freeWeaponCategories, ["light", "medium", "heavy"]);
  assert.deepEqual(system.freeArmorCategories, ["light", "medium"]);
});

test("Brew Potion retains the brewing time and the tier-three and tier-six alternatives", async () => {
  const { system } = await record("abilities-en/_source/d5479157d98fc727.json");
  assert.equal(system.action, null);
  assert.match(system.description, /Ten minutes to brew/);
  assert.match(system.description, /At tier 3:.*low or medium/);
  assert.match(system.description, /At tier 6:.*low, medium-, or advanced-power/);
});

test("Attacking retains its tier restriction and the Fantasy Backpack its price without invented depletion", async () => {
  const skill = await record("skills-en/_source/attacking.json");
  assert.equal(skill.system.minimumTier, 2);
  const backpack = await record("equipment-en/_source/fantasy/035.json");
  assert.equal(backpack.system.priceCategory, "moderate");
  assert.equal(backpack.system.depletionDie, "none");
});
