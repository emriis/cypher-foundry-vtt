/** Direct advancement service contracts relocated from the Actor compatibility suite. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { purchaseAdvancementSlot, advanceTier } from "../../module/applications/advancement-service.mjs";
import { applyDocumentUpdate as applyUpdate } from "../helpers/document-updates.mjs";

beforeEach(() => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  delete globalThis.fromUuid;
});
function makeAdvancementActor(slot, overrides = {}) {
  const updates = [];
  const actor = {
    type: "pc",
    system: {
      xp: 10,
      resourcePoints: 0,
      tier: 1,
      effort: 1,
      recoveryBonus: 0,
      advancementSlots: [
        { type: slot.type, otherType: slot.otherType ?? "", bought: false },
        { type: "", otherType: "", bought: false },
        { type: "", otherType: "", bought: false },
        { type: "", otherType: "", bought: false }
      ],
      stats: {
        might: { pool: { max: 8, value: 8 }, edge: 0 },
        speed: { pool: { max: 8, value: 8 }, edge: 0 },
        intellect: { pool: { max: 8, value: 8 }, edge: 0 }
      },
      freeArmorCategories: [],
      freeWeaponCategories: [],
      canFreelyUseAllArmor: false,
      canFreelyUseAllWeapons: false,
      customStats: [],
      ...overrides
    },
    items: new Map(),
    flags: { cypher: {} },
    updates,
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(changes) {
      updates.push(changes);
      applyUpdate(this, changes);
    },
    async createEmbeddedDocuments(_collection, documents) {
      const created = documents.map(document => ({
        ...document,
        id: document.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      }));
      for (const item of created) this.items.set(item.id, item);
      return created;
    }
  };
  return actor;
}
test("all-category advancements store every weapon or armor category", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  for (const [otherType, expectedPath, expectedCategories] of [
    ["weapons", "system.freeWeaponCategories", ["light", "medium", "heavy"]],
    ["armor", "system.freeArmorCategories", ["light", "medium", "heavy"]]
  ]) {
    let changes;
    const actor = {
      type: "pc",
      id: "actor-id",
      system: {
        xp: 10,
        advancementSlots: [{ type: "other", otherType, bought: false },
          { type: "", otherType: "", bought: false },
          { type: "", otherType: "", bought: false },
          { type: "", otherType: "", bought: false }],
        freeWeaponCategories: ["light"],
        freeArmorCategories: [],
        resourcePoints: 0
      },
      async update(update) { changes = update; }
    };

    await purchaseAdvancementSlot(actor, 0);
    assert.deepEqual(changes[expectedPath], expectedCategories);
  }
});

test("advancing a completed tier grants the selected eligible Focus ability", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  const actor = {
    type: "pc",
    system: { tier: 1, advancementSlots: ["capabilities", "perfection", "effort", "skill"].map(type => ({ type, bought: true })) },
    flags: {
      cypher: {
        appliedFocusGraph: {
          abilities: [
            { type: "ability", uuid: "Compendium.test.abilities.Item.stone-body", id: "stone-body", tier: 1, prerequisites: [], repeatable: false },
            { type: "ability", uuid: "Compendium.test.abilities.Item.golem-grip", id: "golem-grip", tier: 2, prerequisites: ["stone-body"], repeatable: false }
          ]
        },
        focusAbilityIds: ["stone-body"]
      }
    },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      this.lastUpdate = updates;
      this.system.tier = updates["system.tier"];
    }
  };

  globalThis.fromUuid = async () => ({ type: "ability", name: "Grip", system: { tier: 2 } });
  actor.createEmbeddedDocuments = async () => [];
  await advanceTier(actor, { focus: { abilityId: "golem-grip" } });
  assert.equal(actor.lastUpdate["system.tier"], 2);
  assert.equal(actor.lastUpdate["flags.cypher.focusAbilityPendingTier"], null);
});

test("advancement purchases capabilities and applies only the requested pool increases", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = makeAdvancementActor({ type: "capabilities" });
  await purchaseAdvancementSlot(actor, 0, {
    distribution: { might: 2, speed: 1, intellect: 1 }
  });

  assert.equal(actor.system.stats.might.pool.max, 10);
  assert.equal(actor.system.stats.might.pool.value, 10);
  assert.equal(actor.system.stats.speed.pool.max, 9);
  assert.equal(actor.system.stats.speed.pool.value, 9);
  assert.equal(actor.system.stats.intellect.pool.max, 9);
  assert.equal(actor.system.resourcePoints, 1);
  assert.equal(actor.system.advancementSlots[0].bought, true);
  assert.equal(actor.system.xp, 6);
});

test("advancement purchases perfection and increments only the selected Edge", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = makeAdvancementActor({ type: "perfection" });
  actor.system.stats.speed.edge = 2;

  await purchaseAdvancementSlot(actor, 0, { stat: "speed" });

  assert.equal(actor.system.stats.speed.edge, 3);
  assert.equal(actor.system.stats.might.edge, 0);
  assert.equal(actor.system.xp, 6);
});

test("capped Effort cannot consume XP for a useless advancement", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = makeAdvancementActor({ type: "effort" }, { effort: 6 });
  await purchaseAdvancementSlot(actor, 0);

  assert.equal(actor.system.effort, 6);
  assert.equal(actor.system.resourcePoints, 0);
  assert.equal(actor.system.xp, 10);
});

test("skill advancement upgrades an existing skill and creates a trained skill when requested", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = makeAdvancementActor({ type: "skill" });
  const skill = {
    id: "stealth",
    name: "Stealth",
    type: "skill",
    system: { level: "practiced" },
    update: async changes => { skill.system.level = changes["system.level"]; }
  };
  actor.items.set(skill.id, skill);

  await purchaseAdvancementSlot(actor, 0, { skillId: skill.id });
  assert.equal(skill.system.level, "trained");

  const fresh = makeAdvancementActor({ type: "skill" });
  await purchaseAdvancementSlot(fresh, 0, { newSkillName: "Lore" });
  assert.equal(fresh.items.get("lore").system.level, "trained");
});

test("Other advancements grant recovery, armor, and weapon permissions", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const recovery = makeAdvancementActor({ type: "other", otherType: "recovery" });
  await purchaseAdvancementSlot(recovery, 0);
  assert.equal(recovery.system.recoveryBonus, 2);

  const armor = makeAdvancementActor({ type: "other", otherType: "armor" });
  await purchaseAdvancementSlot(armor, 0);
  assert.deepEqual(armor.system.freeArmorCategories, ["light", "medium", "heavy"]);
  assert.equal(armor.system.canFreelyUseAllArmor, true);

  const weapons = makeAdvancementActor({ type: "other", otherType: "weapons" });
  await purchaseAdvancementSlot(weapons, 0);
  assert.deepEqual(weapons.system.freeWeaponCategories, ["light", "medium", "heavy"]);
  assert.equal(weapons.system.canFreelyUseAllWeapons, true);
});

test("completing four advancement slots advances the tier and resets the slots", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = makeAdvancementActor(
    { type: "effort" },
    { tier: 1 }
  );
  actor.system.advancementSlots = [
    { type: "capabilities", otherType: "", bought: true },
    { type: "perfection", otherType: "", bought: true },
    { type: "skill", otherType: "", bought: true },
    { type: "effort", otherType: "", bought: false }
  ];
  actor.flags.cypher.appliedFocusGraph = {
    abilities: [
      { id: "tier-two", tier: 2, prerequisites: ["tier-one"], repeatable: false }
    ]
  };
  actor.flags.cypher.focusAbilityIds = ["tier-one"];

  globalThis.fromUuid = async () => ({ type: "ability", name: "Tier Two", system: { tier: 2 } });
  actor.flags.cypher.appliedFocusGraph.abilities[0].uuid = "Item.tier-two";
  await purchaseAdvancementSlot(actor, 3, { tierChoices: { focus: { abilityId: "tier-two" } } });

  assert.equal(actor.system.tier, 2);
  assert.equal(actor.system.advancementSlots.length, 4);
  assert.ok(actor.system.advancementSlots.every(slot => !slot.bought));
  assert.equal(actor.flags.cypher.focusAbilityPendingTier, null);
});
