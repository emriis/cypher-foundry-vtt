import assert from "node:assert/strict";
import test from "node:test";

import {
  CRD_ABILITY_FIXTURE,
  CRD_TYPE_FIXTURE,
  CRD_FOCUS_FIXTURE,
  CRD_WEAPON_FIXTURE,
  CRD_EQUIPMENT_FIXTURE,
  CRD_CYPHER_FIXTURE,
  CRD_ARMOR_FIXTURE,
  CRD_SKILL_FIXTURE,
  CRD_CREATURE_FIXTURE,
  CRD_TIERED_ABILITY_FIXTURE,
  CRD_FIXTURES
} from "../fixtures/crd-source-fixtures.mjs";
import { validateCrdSourceRecord } from "../../module/crd/source-schema.mjs";

test("representative CRD fixtures satisfy the source schema", () => {
  for (const record of CRD_FIXTURES) {
    assert.deepEqual(
      validateCrdSourceRecord(record),
      [],
      record.name
    );
  }
});

test("Frenzy preserves cost, Effort, action, and tier mechanics", () => {
  assert.equal(CRD_ABILITY_FIXTURE.system.tier, 1);
  assert.equal(CRD_ABILITY_FIXTURE.system.cost.amount, 1);
  assert.equal(CRD_ABILITY_FIXTURE.system.cost.stat, "intellect");
  assert.equal(CRD_ABILITY_FIXTURE.system.cost.additionalEffort, true);
  assert.equal(CRD_ABILITY_FIXTURE.system.enabler, true);
  assert.equal(CRD_ABILITY_FIXTURE.system.action, null);
  assert.equal(CRD_ABILITY_FIXTURE.system.effects[0].tier, null);
  assert.match(
    CRD_ABILITY_FIXTURE.system.effects[0].effort,
    /Ease your allies’ attacks/
  );
});

test("Barbarian preserves its tier-one structured benefits", () => {
  const system = CRD_TYPE_FIXTURE.system;

  assert.deepEqual(system.poolBonuses, {
    might: 3,
    speed: 1,
    intellect: 0
  });
  assert.equal(system.edgeChoice, 1);
  assert.deepEqual(system.woundBonuses, {
    minor: 3,
    moderate: 1,
    major: 0
  });
  assert.equal(system.freeWeapons, true);
  assert.deepEqual(system.freeArmorCategories, ["light", "medium"]);
  assert.equal(system.abilityTiers.length, 3);
  assert.ok(
    system.abilityTiers.every((entry) => entry.tier === 1)
  );
});

test("Howls at the Moon preserves standalone ability references", () => {
  assert.deepEqual(CRD_FOCUS_FIXTURE.system.flowchart.edges, []);
  assert.equal(CRD_FOCUS_FIXTURE.system.abilities.length, 3);
  assert.ok(
    CRD_FOCUS_FIXTURE.system.abilities.every(
      (reference) => reference.startsWith("!items!")
    )
  );
});

test("Shotgun preserves CRD range, category, damage, price, and property", () => {
  const system = CRD_WEAPON_FIXTURE.system;

  assert.equal(system.attackType, "heavy");
  assert.equal(system.range, "immediate");
  assert.equal(system.extremeRange, "short");
  assert.equal(system.damage, 6);
  assert.equal(system.priceCategory, "expensive");
  assert.deepEqual(
    system.properties,
    ["attack hindered if fired with one hand"]
  );
});

test("Backpack preserves default equipment level and price category", () => {
  assert.equal(CRD_EQUIPMENT_FIXTURE.system.level, 4);
  assert.equal(CRD_EQUIPMENT_FIXTURE.system.priceCategory, "moderate");
  assert.equal(CRD_EQUIPMENT_FIXTURE.system.depletionDie, "none");
});

test("Adhesion Bomb preserves manifest cypher power classification", () => {
  assert.equal(CRD_CYPHER_FIXTURE.system.cypherType, "manifest");
  assert.equal(CRD_CYPHER_FIXTURE.system.powerLevel, "medium");
  assert.match(
    CRD_CYPHER_FIXTURE.system.description,
    /immediate-radius explosion/
  );
});


test("Leather jacket preserves the CRD armor category and price", () => {
  const system = CRD_ARMOR_FIXTURE.system;

  assert.equal(system.category, "light");
  assert.equal(system.priceCategory, "moderate");
  assert.equal(system.blockEaseDamage, 0);
});

test("Attacking preserves its CRD tier restriction", () => {
  assert.equal(CRD_SKILL_FIXTURE.system.minimumTier, 2);
  assert.equal(CRD_SKILL_FIXTURE.system.level, "trained");
});

test("Giant spider preserves its mapped NPC mechanics", () => {
  const system = CRD_CREATURE_FIXTURE.system;

  assert.equal(system.level, 3);
  assert.equal(system.health.max, 12);
  assert.equal(system.damage, "3 + 1 Speed damage from poison");
  assert.match(system.modifications, /level 5/);
  assert.match(system.modifications, /level 4/);
});

test("Always Tinkering preserves real tier-three and tier-six effects", () => {
  const effects = CRD_TIERED_ABILITY_FIXTURE.system.effects;

  assert.deepEqual(
    effects.map(effect => effect.tier),
    [3, 6]
  );
  assert.match(effects[0].description, /medium-power manifest cypher/);
  assert.match(effects[1].description, /advanced-power manifest cypher/);
});


test("Leather jacket preserves its CRD armor category and price", () => {
  const system = CRD_ARMOR_FIXTURE.system;

  assert.equal(CRD_ARMOR_FIXTURE.crdType, "armor");
  assert.equal(system.category, "light");
  assert.equal(system.priceCategory, "moderate");
  assert.equal(system.blockEaseDamage, 0);
});

test("Attacking preserves its CRD tier restriction", () => {
  const system = CRD_SKILL_FIXTURE.system;

  assert.equal(CRD_SKILL_FIXTURE.crdType, "skill");
  assert.equal(CRD_SKILL_FIXTURE.name, "Attacking");
  assert.equal(system.minimumTier, 2);
  assert.equal(system.attackCategory, "");
});

test("Always Tinkering preserves tier 3 and tier 6 effects", () => {
  const effects = CRD_TIERED_ABILITY_FIXTURE.system.effects;

  assert.deepEqual(
    effects.map(effect => effect.tier),
    [3, 6]
  );
  assert.match(effects[0].description, /medium-power manifest cypher/);
  assert.match(effects[1].description, /advanced-power manifest cypher/);
});
