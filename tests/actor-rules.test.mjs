// Tests actor-owned Cypher rules with a minimal Actor stub instead of a live Foundry world.
import assert from "node:assert/strict";
import test from "node:test";

// The document class extends Foundry's global Actor, but these rule helpers do
// not need a Foundry runtime.
globalThis.Actor = class Actor {};
class StubField {}
globalThis.foundry = {
  abstract: { TypeDataModel: class TypeDataModel {} },
  data: {
    fields: Object.fromEntries([
      "SchemaField", "NumberField", "StringField", "HTMLField", "BooleanField", "ArrayField"
    ].map(name => [name, StubField]))
  }
};

const { default: CypherActor } = await import("../module/documents/actor.mjs");
const { default: CypherPCData } = await import("../module/data-models/actor-pc.mjs");

test("computeEffortCost charges the first level, additional levels, and Edge once", () => {
  assert.equal(CypherActor.computeEffortCost(1), 3);
  assert.equal(CypherActor.computeEffortCost(3), 7);
  assert.equal(CypherActor.computeEffortCost(3, 2), 5);
  assert.equal(CypherActor.computeEffortCost(1, 5), 0);
});

test("computeEffortCost does not charge for zero or negative Effort", () => {
  assert.equal(CypherActor.computeEffortCost(0), 0);
  assert.equal(CypherActor.computeEffortCost(-1), 0);
});

test("applyDescriptor records an eligible species separately and enables its second descriptor", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  const actor = {
    type: "pc",
    system: {
      genre: "fantasy",
      descriptor: "Brash",
      descriptor2: "",
      species: "",
      hasSecondDescriptor: false,
      stats: {
        might: { pool: { max: 8, value: 8 } },
        speed: { pool: { max: 8, value: 8 } },
        intellect: { pool: { max: 8, value: 8 } }
      }
    },
    items: [],
    flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        const segments = path.split(".");
        let target = this;
        for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
        target[segments.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(collection, documents) {
      this.items.push(...documents);
      return documents;
    }
  };
  const human = {
    id: "human-id",
    type: "descriptor",
    name: "Human",
    system: {
      category: "species",
      genres: ["fantasy", "sciFi"],
      grantsSecondDescriptor: true,
      statOptions: [],
      statAmount: 0,
      skillOptions: [],
      benefits: []
    }
  };

  assert.equal(await CypherActor.prototype.applyDescriptor.call(actor, human), true);
  assert.equal(actor.system.species, "Human");
  assert.equal(actor.system.descriptor, "Brash");
  assert.equal(actor.system.hasSecondDescriptor, true);
  assert.equal(actor.flags.cypher.appliedSpeciesId, "human-id");
  assert.equal(await CypherActor.prototype.applyDescriptor.call(actor, human), false);
});

test("applyDescriptor creates Dragonfolk benefits as abilities and Intimidation as a skill", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  const actor = {
    type: "pc",
    system: {
      genre: "fantasy",
      species: "",
      hasSecondDescriptor: false,
      stats: {
        might: { pool: { max: 8, value: 8 } },
        speed: { pool: { max: 8, value: 8 } },
        intellect: { pool: { max: 8, value: 8 } }
      }
    },
    items: [],
    flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        const segments = path.split(".");
        let target = this;
        for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
        target[segments.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(collection, documents) {
      this.items.push(...documents);
      return documents;
    }
  };
  const dragonfolk = {
    id: "dragonfolk-id",
    type: "descriptor",
    name: "Dragonfolk",
    system: {
      category: "species",
      genres: ["fantasy"],
      grantsSecondDescriptor: false,
      statOptions: [],
      statAmount: 0,
      skillOptions: ["Intimidation"],
      benefits: [
        { name: "No GM Intrusion on Block", description: "No GM intrusion on a block task." },
        { name: "Energy Attack Damage", description: "+1 damage with a chosen energy." }
      ]
    }
  };

  assert.equal(await CypherActor.prototype.applyDescriptor.call(actor, dragonfolk, { skillName: "Intimidation" }), true);
  assert.deepEqual(actor.items.filter(item => item.type === "skill").map(item => item.name), ["Intimidation"]);
  assert.deepEqual(actor.items.filter(item => item.type === "ability").map(item => item.name), ["No GM Intrusion on Block", "Energy Attack Damage"]);
  for (const ability of actor.items.filter(item => item.type === "ability")) {
    assert.equal(ability.system.source, "Dragonfolk");
    assert.equal(ability.system.enabler, true);
    assert.deepEqual(ability.system.cost, { stat: "none", amount: 0, options: [] });
    assert.equal(ability.system.action, "none");
  }
});

test("applyDescriptor grants both Naron's selected and fixed trained skills", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  const actor = {
    type: "pc",
    system: {
      genre: "sciFi",
      species: "",
      hasSecondDescriptor: false,
      stats: {
        might: { pool: { max: 8, value: 8 } },
        speed: { pool: { max: 8, value: 8 } },
        intellect: { pool: { max: 8, value: 8 } }
      }
    },
    items: [],
    flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        const segments = path.split(".");
        let target = this;
        for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
        target[segments.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(collection, documents) {
      this.items.push(...documents);
      return documents;
    }
  };
  const naron = {
    id: "naron-id",
    type: "descriptor",
    name: "Naron",
    system: {
      category: "species",
      genres: ["sciFi"],
      grantsSecondDescriptor: false,
      statOptions: [],
      statAmount: 0,
      skillOptions: ["Persuasion", "Deception"],
      grantedSkills: ["Recognizing Motive"],
      benefits: []
    }
  };

  assert.equal(await CypherActor.prototype.applyDescriptor.call(actor, naron, { skillName: "Persuasion" }), true);
  assert.deepEqual(actor.items.map(item => [item.name, item.system.level]), [
    ["Persuasion", "trained"],
    ["Recognizing Motive", "trained"]
  ]);
});

test("getEligibleFocusAbilities allows any linked prerequisite to unlock a higher-tier Focus ability", () => {
  const focus = {
    abilities: [
      { id: "intimidating-presence", tier: 1, prerequisites: [], repeatable: false },
      { id: "stone-body", tier: 1, prerequisites: [], repeatable: false },
      { id: "stone-bash", tier: 2, prerequisites: ["intimidating-presence", "stone-body"], repeatable: false },
      { id: "golem-grip", tier: 2, prerequisites: ["stone-body"], repeatable: false }
    ]
  };

  const eligible = CypherActor.getEligibleFocusAbilities(focus, ["intimidating-presence"], 2);
  assert.deepEqual(eligible.map(ability => ability.id), ["stone-body", "stone-bash"]);
  assert.equal(CypherActor.isFocusAbilityEligible(focus, ["intimidating-presence"], "golem-grip", 2), false);
  assert.equal(CypherActor.isFocusAbilityEligible(focus, ["stone-body"], "stone-bash", 2), true);
  assert.equal(CypherActor.isFocusAbilityEligible(focus, ["intimidating-presence"], "stone-bash", 1), false);
});

test("reduceWoundSeverity lowers wounds by one tier", () => {
  const reduce = CypherActor.prototype._reduceWoundSeverity;

  assert.equal(reduce.call({}, "major"), "moderate");
  assert.equal(reduce.call({}, "moderate"), "minor");
  assert.equal(reduce.call({}, "minor"), null);
  assert.equal(reduce.call({}, "unknown"), null);
});

test("armor free use is checked against the equipped armor's exact category", () => {
  const actorData = {
    stats: {
      might: { pool: { value: 8 } },
      speed: { pool: { value: 8 } },
      intellect: { pool: { value: 8 } }
    },
    customStats: [],
    wounds: {
      minor: { current: 0, max: 3 },
      moderate: { current: 0, max: 3 },
      major: { current: 0, max: 3 }
    },
    genre: "none",
    powerShifts: {},
    advancementSlots: [],
    freeArmorCategories: ["light"],
    canFreelyUseAllArmor: false,
    parent: {
      items: [{ type: "armor", id: "armor-id", name: "Chainmail", system: { equipped: true, category: "medium", blockEaseDamage: 0 } }]
    }
  };

  CypherPCData.prototype._prepareDerivedDataUnsafe.call(actorData);
  assert.equal(actorData.armor.freelyUsable, false);
  assert.equal(actorData.armor.dodgeHinder, 2);
  assert.equal(actorData.armor.speedTaskHinder, 2);

  actorData.freeArmorCategories = ["light", "medium"];
  CypherPCData.prototype._prepareDerivedDataUnsafe.call(actorData);
  assert.equal(actorData.armor.freelyUsable, true);
  assert.equal(actorData.armor.dodgeHinder, 2);
  assert.equal(actorData.armor.speedTaskHinder, 0);
});

test("convertDamageToWound honors documented damage thresholds", () => {
  const convert = CypherActor.prototype._convertDamageToWound;

  assert.equal(convert.call({}, 1), "minor");
  assert.equal(convert.call({}, 4), "minor");
  assert.equal(convert.call({}, 5), "moderate");
  assert.equal(convert.call({}, 8), "moderate");
  assert.equal(convert.call({}, 9), "major");
});

test("applyType applies pool, Edge, wound, and equipment benefits once", async () => {
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.game = {
    i18n: {
      localize: value => value,
      format: (value, data) => `${value}:${data.name ?? data.level ?? ""}`
    }
  };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async () => {}
  };

  const actor = {
    type: "pc",
    id: "actor-id",
    system: {
      genre: "none",
      stats: {
        might: { pool: { max: 8, value: 5 }, edge: 0 },
        speed: { pool: { max: 8, value: 8 }, edge: 1 },
        intellect: { pool: { max: 8, value: 8 }, edge: 0 }
      },
      wounds: {
        minor: { max: 3, current: 0 },
        moderate: { max: 3, current: 0 },
        major: { max: 3, current: 0 }
      }
    },
    items: [],
    flags: {},
    async createEmbeddedDocuments(collection, documents) {
      assert.equal(collection, "Item");
      this.items.push(...documents.map(document => ({ ...document, id: `${document.name}-id` })));
      return documents;
    },
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        if (path === "flags.cypher.appliedTypeId") {
          this.flags.cypher ??= {};
          this.flags.cypher.appliedTypeId = value;
          continue;
        }
        const segments = path.split(".");
        let target = this;
        for (const segment of segments.slice(0, -1)) target = target[segment];
        target[segments.at(-1)] = value;
      }
    }
  };
  const typeItem = {
    id: "barbarian-id",
    name: "Barbarian",
    type: "type",
    system: {
      genre: "Fantasy",
      poolBonuses: { might: 3, speed: 1, intellect: 0 },
      edgeChoice: 1,
      woundBonuses: { minor: 3, moderate: 1, major: 0 },
      freeWeapons: true,
      freeArmor: true,
      skillOptions: [],
      abilities: [{
        name: "Frenzy",
        tier: 1,
        enabler: false,
        cost: { stat: "intellect", amount: 1 },
        description: "Enter a state of frenzy."
      }]
    }
  };

  assert.equal(await CypherActor.prototype.applyType.call(actor, typeItem, { stat: "speed" }), true);
  assert.equal(actor.system.type, "Barbarian");
  assert.equal(actor.system.genre, "fantasy");
  assert.deepEqual(actor.system.stats.might.pool, { max: 11, value: 8 });
  assert.deepEqual(actor.system.stats.speed.pool, { max: 9, value: 9 });
  assert.equal(actor.system.stats.speed.edge, 2);
  assert.equal(actor.system.wounds.minor.max, 6);
  assert.equal(actor.system.wounds.moderate.max, 4);
  assert.equal(actor.system.canFreelyUseAllWeapons, true);
  assert.equal(actor.system.canFreelyUseAllArmor, true);
  assert.deepEqual(actor.items[0].system, {
    source: "Barbarian",
    tier: 1,
    enabler: false,
    cost: { stat: "intellect", amount: 1 },
    action: "none",
    description: "Enter a state of frenzy."
  });

  assert.equal(await CypherActor.prototype.applyType.call(actor, typeItem), false);
});

test("applyType preserves free-use categories instead of granting every category", async () => {
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.game = {
    i18n: {
      localize: value => value,
      format: value => value
    }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = {
    type: "pc",
    id: "actor-id",
    system: {
      genre: "none",
      stats: {
        might: { pool: { max: 8, value: 8 }, edge: 0 },
        speed: { pool: { max: 8, value: 8 }, edge: 0 },
        intellect: { pool: { max: 8, value: 8 }, edge: 0 }
      },
      wounds: {
        minor: { max: 3, current: 0 },
        moderate: { max: 3, current: 0 },
        major: { max: 3, current: 0 }
      },
      freeWeaponCategories: ["light"],
      freeArmorCategories: [],
      canFreelyUseAllWeapons: false,
      canFreelyUseAllArmor: false
    },
    items: [],
    flags: {},
    async createEmbeddedDocuments(_collection, documents) { this.items.push(...documents); },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        if (path === "flags.cypher.appliedTypeId") {
          this.flags.cypher ??= {};
          this.flags.cypher.appliedTypeId = value;
          continue;
        }
        const segments = path.split(".");
        let target = this;
        for (const segment of segments.slice(0, -1)) target = target[segment];
        target[segments.at(-1)] = value;
      }
    }
  };
  const typeItem = {
    id: "cleric-id",
    name: "Cleric",
    type: "type",
    system: {
      genre: "Fantasy",
      poolBonuses: {},
      woundBonuses: {},
      freeWeaponCategories: ["light", "medium"],
      freeArmorCategories: ["light", "medium", "heavy"],
      freeWeaponFamilies: ["axes"],
      freeWeapons: false,
      freeArmor: false,
      skillOptions: [],
      abilities: []
    }
  };

  assert.equal(await CypherActor.prototype.applyType.call(actor, typeItem), true);
  assert.deepEqual(actor.system.freeWeaponCategories, ["light", "medium"]);
  assert.deepEqual(actor.system.freeArmorCategories, ["light", "medium", "heavy"]);
  assert.deepEqual(actor.system.freeWeaponFamilies, ["axes"]);
  assert.equal(actor.system.canFreelyUseAllWeapons, false);
  assert.equal(actor.system.canFreelyUseAllArmor, false);
});

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
        advancementSlots: [{ type: "other", otherType, bought: false },
          { type: "", otherType: "", bought: false },
          { type: "", otherType: "", bought: false },
          { type: "", otherType: "", bought: false }],
        freeWeaponCategories: ["light"],
        freeArmorCategories: [],
        resourcePoints: 0
      },
      async spendXP() { return true; },
      async update(update) { changes = update; }
    };

    await CypherActor.prototype.purchaseAdvancementSlot.call(actor, 0);
    assert.deepEqual(changes[expectedPath], expectedCategories);
  }
});

test("applyFocus records two tier-1 selections and creates their ability items", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  const actor = {
    type: "pc",
    system: { tier: 1, focus: "" },
    flags: {},
    items: [],
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        const segments = path.split(".");
        let target = this;
        for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
        target[segments.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(collection, documents) {
      assert.equal(collection, "Item");
      this.items.push(...documents);
      return documents;
    }
  };
  const focus = {
    id: "abides-in-stone",
    type: "focus",
    name: "Abides in Stone",
    system: {
      abilities: [
        { id: "intimidating-presence", name: "Intimidating Presence", tier: 1, prerequisites: [], repeatable: false, enabler: true, cost: { stat: "none", amount: 0 }, description: "" },
        { id: "stone-body", name: "Stone Body", tier: 1, prerequisites: [], repeatable: false, enabler: true, cost: { stat: "none", amount: 0 }, description: "" },
        { id: "stone-bash", name: "Stone Bash", tier: 2, prerequisites: ["intimidating-presence", "stone-body"], repeatable: false, enabler: true, cost: { stat: "none", amount: 0 }, description: "" }
      ]
    }
  };

  assert.equal(await CypherActor.prototype.applyFocus.call(actor, focus, ["intimidating-presence", "stone-body"]), true);
  assert.equal(actor.system.focus, "Abides in Stone");
  assert.deepEqual(actor.flags.cypher.focusAbilityIds, ["intimidating-presence", "stone-body"]);
  assert.deepEqual(actor.items.map(item => item.system.focusAbilityId), ["intimidating-presence", "stone-body"]);
});

test("applyFocus applies only the selected abilities' free-use grants", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  const actor = {
    type: "pc",
    system: {
      tier: 1,
      focus: "",
      freeWeaponCategories: ["light"],
      freeArmorCategories: [],
      freeWeaponFamilies: []
    },
    flags: {},
    items: [],
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        const segments = path.split(".");
        let target = this;
        for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
        target[segments.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(_collection, documents) { this.items.push(...documents); }
  };
  const focus = {
    id: "focus-id",
    type: "focus",
    name: "Test Focus",
    system: {
      abilities: [
        { id: "chosen", name: "Chosen", tier: 1, prerequisites: [], repeatable: false, freeWeaponCategories: ["medium"], freeArmorCategories: ["light"], freeWeaponFamilies: ["firearms"], chooseWeaponAttackCategory: true, grantedArmorItemCategory: "light" },
        { id: "also-chosen", name: "Also Chosen", tier: 1, prerequisites: [], repeatable: false, freeWeaponCategories: [], freeArmorCategories: [], freeWeaponFamilies: [] },
        { id: "not-chosen", name: "Not Chosen", tier: 1, prerequisites: [], repeatable: false, freeWeaponCategories: ["heavy"], freeArmorCategories: ["heavy"], freeWeaponFamilies: ["swords"] }
      ]
    }
  };

  assert.equal(await CypherActor.prototype.applyFocus.call(actor, focus, ["chosen", "also-chosen"], { chosen: "mediumBladed" }), true);
  assert.deepEqual(actor.system.freeWeaponCategories, ["light", "medium"]);
  assert.deepEqual(actor.system.freeArmorCategories, ["light"]);
  assert.deepEqual(actor.system.freeWeaponFamilies, ["firearms"]);
  assert.deepEqual(actor.system.freeWeaponSkillCategories, ["mediumBladed"]);
  assert.deepEqual(actor.items.filter(item => item.type === "armor").map(item => [item.system.category, item.system.freelyUsable]), [["light", true]]);
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
            { id: "stone-body", tier: 1, prerequisites: [], repeatable: false },
            { id: "golem-grip", tier: 2, prerequisites: ["stone-body"], repeatable: false }
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

  await CypherActor.prototype._advanceTier.call(actor);
  assert.equal(actor.lastUpdate["system.tier"], 2);
  assert.equal(actor.lastUpdate["flags.cypher.focusAbilityPendingTier"], 2);
});

test("selectFocusAbility stores and embeds the selected pending Focus ability", async () => {
  const actor = {
    type: "pc",
    system: { tier: 2, focus: "Abides in Stone" },
    flags: {
      cypher: {
        focusAbilityPendingTier: 2,
        focusAbilityIds: ["stone-body"],
        appliedFocusGraph: {
          abilities: [
            { id: "stone-body", name: "Stone Body", tier: 1, prerequisites: [], repeatable: false, enabler: true, cost: { stat: "none", amount: 0 }, description: "" },
            { id: "golem-grip", name: "Golem Grip", tier: 2, prerequisites: ["stone-body"], repeatable: false, enabler: false, cost: { stat: "might", amount: 3 }, description: "" }
          ]
        }
      }
    },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      this.lastUpdate = updates;
      Object.assign(this.flags.cypher, {
        focusAbilityIds: updates["flags.cypher.focusAbilityIds"],
        focusAbilityPendingTier: updates["flags.cypher.focusAbilityPendingTier"]
      });
    },
    async createEmbeddedDocuments(collection, documents) {
      assert.equal(collection, "Item");
      this.created = documents;
    }
  };

  assert.equal(await CypherActor.prototype.selectFocusAbility.call(actor, "golem-grip"), true);
  assert.deepEqual(actor.lastUpdate["flags.cypher.focusAbilityIds"], ["stone-body", "golem-grip"]);
  assert.equal(actor.lastUpdate["flags.cypher.focusAbilityPendingTier"], null);
  assert.equal(actor.created[0].system.focusAbilityId, "golem-grip");
});
