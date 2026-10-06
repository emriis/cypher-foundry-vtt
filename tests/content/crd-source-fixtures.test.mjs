import assert from "node:assert/strict";
import test from "node:test";

import {
  CRD_ABILITY_FIXTURE,
  CRD_TYPE_FIXTURE,
  CRD_FOCUS_FIXTURE,
  CRD_WEAPON_FIXTURE,
  CRD_QUARTERSTAFF_FIXTURE,
  CRD_STUNSTICK_FIXTURE,
  CRD_MONOMOLECULAR_BLADE_FIXTURE,
  CRD_VACUUM_ASSAULT_RIFLE_FIXTURE,
  CRD_BLAST_CANNON_FIXTURE,
  CRD_EQUIPMENT_FIXTURE,
  CRD_CYPHER_FIXTURE,
  CRD_ARMOR_FIXTURE,
  CRD_SKILL_FIXTURE,
  CRD_TIERED_ABILITY_FIXTURE,
  CRD_RECOVERY_ABILITY_FIXTURE,
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


test("Shotgun keeps its structured two-handed weapon mechanic", () => {
  assert.equal(CRD_WEAPON_FIXTURE.system.mechanics.twoHanded, true);
  assert.equal(CRD_WEAPON_FIXTURE.system.mechanics.rapidFire, false);
  assert.deepEqual(CRD_WEAPON_FIXTURE.system.mechanics.targetEffects, []);
});

test("Quarterstaff preserves two-handed use independently of weapon category", () => {
  assert.equal(CRD_QUARTERSTAFF_FIXTURE.system.attackType, "medium");
  assert.equal(CRD_QUARTERSTAFF_FIXTURE.system.mechanics.twoHanded, true);
});

test("Stunstick preserves level-gated target effects", () => {
  assert.equal(CRD_STUNSTICK_FIXTURE.system.damage, 0);
  assert.deepEqual(CRD_STUNSTICK_FIXTURE.system.mechanics.targetEffects, [
    {
      minimumTargetLevel: 0,
      maximumTargetLevel: 2,
      effect: "loseNextAction",
      hinderSteps: 0,
      duration: "next action"
    },
    {
      minimumTargetLevel: 3,
      maximumTargetLevel: null,
      effect: "hindered",
      hinderSteps: 2,
      duration: "a round or two"
    }
  ]);
});

test("Monomolecular blade preserves armor penetration and material level", () => {
  const mechanics = CRD_MONOMOLECULAR_BLADE_FIXTURE.system.mechanics;

  assert.equal(mechanics.ignoresPhysicalArmor, 1);
  assert.equal(mechanics.cutsThroughMaterialsLevel, 6);
});

test("Vacuum assault rifle preserves rapid fire and alternate configuration", () => {
  const mechanics = CRD_VACUUM_ASSAULT_RIFLE_FIXTURE.system.mechanics;

  assert.equal(mechanics.rapidFire, true);
  assert.deepEqual(mechanics.alternateConfiguration, {
    enabled: true,
    attackType: "medium",
    action: "action"
  });
});

test("Blast cannon preserves operator and tripod requirements", () => {
  const system = CRD_BLAST_CANNON_FIXTURE.system;

  assert.equal(system.damage, 10);
  assert.equal(system.mechanics.rapidFire, true);
  assert.equal(system.mechanics.requiresTripod, true);
  assert.equal(system.mechanics.requiredOperators, 2);
});

test("Backpack preserves default equipment level and price category", () => {
  assert.equal(CRD_EQUIPMENT_FIXTURE.system.level, 4);
  assert.equal(CRD_EQUIPMENT_FIXTURE.system.priceCategory, "moderate");
  assert.equal(CRD_EQUIPMENT_FIXTURE.system.depletionDie, "none");
});

test("Adhesion Bomb preserves manifest cypher power classification", () => {
  assert.equal(CRD_CYPHER_FIXTURE.system.cypherType, "manifest");
  assert.equal(CRD_CYPHER_FIXTURE.system.level, 6);
  assert.equal(CRD_CYPHER_FIXTURE.system.powerLevel, "medium");
  assert.match(
    CRD_CYPHER_FIXTURE.system.description,
    /immediate-radius explosion/
  );
});


test("Armor, skill, and tiered ability preserve their CRD identity", () => {
  assert.equal(CRD_ARMOR_FIXTURE.crdType, "armor");
  assert.equal(CRD_SKILL_FIXTURE.crdType, "skill");
  assert.equal(CRD_TIERED_ABILITY_FIXTURE.crdType, "ability");
  assert.equal(CRD_SKILL_FIXTURE.name, "Attacking");
});

test("Attacking preserves its CRD tier restriction", () => {
  assert.equal(CRD_SKILL_FIXTURE.system.minimumTier, 2);
  assert.equal(CRD_SKILL_FIXTURE.system.level, "trained");
  assert.equal(CRD_SKILL_FIXTURE.system.attackCategory, "");
});

test("Leather jacket preserves its CRD armor category and price", () => {
  const system = CRD_ARMOR_FIXTURE.system;

  assert.equal(system.category, "light");
  assert.equal(system.priceCategory, "moderate");
  assert.equal(system.blockEaseDamage, 0);
});

test("Brew Potion preserves its tier-three and tier-six effects", () => {
  const effects = CRD_TIERED_ABILITY_FIXTURE.system.effects;

  assert.equal(CRD_TIERED_ABILITY_FIXTURE.system.action, null);
  assert.match(
    CRD_TIERED_ABILITY_FIXTURE.system.description,
    /Ten minutes to brew/
  );
  assert.deepEqual(
    effects.map(effect => effect.tier),
    [null, 3, 6]
  );
  assert.match(effects[1].description, /low or medium-power manifest cypher/);
  assert.match(
    effects[2].description,
    /low, medium-, or advanced-power manifest cypher/
  );
});

test("CRD fixture identities and provenance remain stable", () => {
  const ids = CRD_FIXTURES.map(record => record._id);
  const logicalIds = CRD_FIXTURES.map(
    record => record.flags.cypherFoundry.crd.logicalId
  );

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(logicalIds).size, logicalIds.length);

  for (const record of CRD_FIXTURES) {
    const provenance = record.flags.cypherFoundry.crd;

    assert.equal(provenance.version, "2026-07-29");
    assert.equal(provenance.language, "en");
    assert.ok(
      provenance.logicalId.startsWith(record.crdType + ".")
    );
    assert.deepEqual(
      provenance.transformations,
      ["structural field mapping only"]
    );
    assert.match(provenance.sourceLocator, /\S/);
  }
});

test("CRD item references preserve Foundry target identity", () => {
  for (const record of CRD_FIXTURES) {
    const references = JSON.stringify(record.system)
      .match(/!items![a-zA-Z0-9]{16}/g) || [];

    for (const reference of references) {
      assert.match(reference, /^!items![a-zA-Z0-9]{16}$/);
    }
  }
});
