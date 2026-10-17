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

test("advancing a tier records a pending Focus selection when an ability becomes eligible", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  const actor = {
    system: { tier: 1 },
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

  await advanceTier(actor);
  assert.equal(actor.lastUpdate["system.tier"], 2);
  assert.equal(actor.lastUpdate["flags.cypher.focusAbilityPendingTier"], 2);
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

test("advancement increases Effort but caps it at six", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = makeAdvancementActor({ type: "effort" }, { effort: 6 });
  await purchaseAdvancementSlot(actor, 0);

  assert.equal(actor.system.effort, 6);
  assert.equal(actor.system.resourcePoints, 1);
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

  actor.system.advancementSlots[0] = {
    type: "skill", otherType: "", bought: false
  };
  await purchaseAdvancementSlot(actor, 0, {
    newSkillName: "Lore"
  });

  assert.equal(actor.items.get("lore").system.level, "trained");
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
    { type: "effort", otherType: "", bought: true },
    { type: "effort", otherType: "", bought: true },
    { type: "effort", otherType: "", bought: true },
    { type: "effort", otherType: "", bought: false }
  ];
  actor.flags.cypher.appliedFocusGraph = {
    abilities: [
      { id: "tier-two", tier: 2, prerequisites: ["tier-one"], repeatable: false }
    ]
  };
  actor.flags.cypher.focusAbilityIds = ["tier-one"];

  await purchaseAdvancementSlot(actor, 3);

  assert.equal(actor.system.tier, 2);
  assert.equal(actor.system.advancementSlots.length, 4);
  assert.ok(actor.system.advancementSlots.every(slot => !slot.bought));
  assert.equal(actor.flags.cypher.focusAbilityPendingTier, 2);
});
