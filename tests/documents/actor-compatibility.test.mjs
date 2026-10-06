import {
  validateAdvancementChoices
} from "../../module/rules/advancement.mjs";
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

const { default: CypherActor } = await import("../../module/documents/actor.mjs");
const { default: CypherPCData } = await import("../../module/data-models/actor-pc.mjs");

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
    assert.equal(ability.system.action, null);
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

test("armor derived dodge uses explicit encumbrance and CRD overrides", () => {
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
    freeArmorCategories: [],
    canFreelyUseAllArmor: false,
    parent: {
      items: [{
        type: "armor",
        id: "armor-id",
        name: "Elven chainmail",
        system: {
          equipped: true,
          category: "medium",
          encumbranceCategory: "light",
          blockEaseDamage: 0
        }
      }]
    }
  };

  CypherPCData.prototype._prepareDerivedDataUnsafe.call(actorData);
  assert.equal(actorData.armor.dodgeHinder, 1);
  assert.equal(actorData.armor.speedTaskHinder, 1);

  actorData.parent.items[0].system = {
    equipped: true,
    category: "light",
    blockEaseDamage: 0,
    dodgeHindrance: 0
  };
  CypherPCData.prototype._prepareDerivedDataUnsafe.call(actorData);
  assert.equal(actorData.armor.dodgeHinder, 0);
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
        type: "ability",
        id: "frenzy-id",
        uuid: "Actor.actor-id.Item.frenzy-id",
        name: "Frenzy",
        tier: 1,
        enabler: false,
        cost: { stat: "intellect", amount: 1 },
        action: null,
        repeatable: false,
        effects: [],
        rollTables: [],
        description: "Enter a state of frenzy."
      }]
    }
  };

  typeItem.system.abilities = typeItem.system.abilities.map(ability => ({
    type: "ability",
    id: ability.id,
    uuid: ability.uuid,
    name: ability.name,
    system: (({ type, id, uuid, name, ...system }) => system)(ability)
  }));

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
    action: null,
    repeatable: false,
    effects: [],
    rollTables: [],
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
        { type: "ability", id: "intimidating-presence", uuid: "Compendium.test.abilities.Item.intimidating-presence", name: "Intimidating Presence", tier: 1, prerequisites: [], repeatable: false, enabler: true, cost: { stat: "none", amount: 0 }, description: "" },
        { type: "ability", id: "stone-body", uuid: "Compendium.test.abilities.Item.stone-body", name: "Stone Body", tier: 1, prerequisites: [], repeatable: false, enabler: true, cost: { stat: "none", amount: 0 }, description: "" },
        { type: "ability", id: "stone-bash", uuid: "Compendium.test.abilities.Item.stone-bash", name: "Stone Bash", tier: 2, prerequisites: ["intimidating-presence", "stone-body"], repeatable: false, enabler: true, cost: { stat: "none", amount: 0 }, description: "" }
      ]
    }
  };

  focus.system.abilities = focus.system.abilities.map(ability => ({
    type: "ability",
    id: ability.id,
    uuid: ability.uuid,
    name: ability.name,
    system: { ...ability }
  }));

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
        { type: "ability", id: "chosen", uuid: "Compendium.test.abilities.Item.chosen", name: "Chosen", tier: 1, prerequisites: [], repeatable: false, freeWeaponCategories: ["medium"], freeArmorCategories: ["light"], freeWeaponFamilies: ["firearms"], chooseWeaponAttackCategory: true, grantedArmorItemCategory: "light" },
        { type: "ability", id: "also-chosen", uuid: "Compendium.test.abilities.Item.also-chosen", name: "Also Chosen", tier: 1, prerequisites: [], repeatable: false, freeWeaponCategories: [], freeArmorCategories: [], freeWeaponFamilies: [] },
        { type: "ability", id: "not-chosen", uuid: "Compendium.test.abilities.Item.not-chosen", name: "Not Chosen", tier: 1, prerequisites: [], repeatable: false, freeWeaponCategories: ["heavy"], freeArmorCategories: ["heavy"], freeWeaponFamilies: ["swords"] }
      ]
    }
  };

  focus.system.abilities = focus.system.abilities.map(ability => ({
    type: "ability",
    id: ability.id,
    uuid: ability.uuid,
    name: ability.name,
    system: { ...ability }
  }));

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

  await CypherActor.prototype._advanceTier.call(actor);
  assert.equal(actor.lastUpdate["system.tier"], 2);
  assert.equal(actor.lastUpdate["flags.cypher.focusAbilityPendingTier"], 2);
});

test("selectFocusAbility stores and embeds the selected pending Focus ability", async () => {
  globalThis.fromUuid = async uuid => ({
    type: "ability",
    id: uuid.split(".").at(-1),
    name: uuid.split(".").at(-1),
    system: {
      tier: 2,
      enabler: false,
      repeatable: false,
      cost: { stat: "might", amount: 3, options: [] },
      action: null,
      effects: [],
      rollTables: [],
      description: ""
    },
    uuid
  });

  const actor = {
    type: "pc",
    system: { tier: 2, focus: "Abides in Stone" },
    flags: {
      cypher: {
        focusAbilityPendingTier: 2,
        focusAbilityIds: ["stone-body"],
        appliedFocusGraph: {
          abilities: [
            { id: "stone-body", uuid: "Compendium.test.abilities.Item.stone-body", name: "Stone Body", tier: 1, prerequisites: [], repeatable: false, enabler: true, cost: { stat: "none", amount: 0 }, description: "" },
            { id: "golem-grip", uuid: "Compendium.test.abilities.Item.golem-grip", name: "Golem Grip", tier: 2, prerequisites: ["stone-body"], repeatable: false, enabler: false, cost: { stat: "might", amount: 3 }, description: "" }
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




test("rollDefense maps Block and Dodge to the correct stat and armor modifier", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.Roll = class {
    constructor() { this.total = 10; }
    async evaluate() { return this; }
    async toMessage() {}
  };
  const actor = {
    type: "pc",
    system: {
      armor: { blockEase: 1, dodgeHinder: 2 },
      stats: {
        might: { pool: { value: 10, max: 10 }, edge: 0 },
        speed: { pool: { value: 10, max: 10 }, edge: 0 },
        intellect: { pool: { value: 10, max: 10 }, edge: 0 }
      },
      effort: 1,
      hinderSteps: 0,
      wounds: {
        minor: { current: 0, max: 3 },
        moderate: { current: 0, max: 3 },
        major: { current: 0, max: 3 }
      }
    },
    items: new Map(),
    async update() {},
    async toggleStatusEffect() {}
  };

  const block = await CypherActor.prototype.rollDefense.call(actor, "block", {
    difficulty: 4,
    incomingSeverity: "moderate"
  });
  assert.equal(block.stat, "might");
  assert.equal(block.armorModifier, 1);
  assert.equal(block.defenseType, "block");
  assert.equal(block.incomingSeverity, "moderate");

  const dodge = await CypherActor.prototype.rollDefense.call(actor, "dodge", {
    difficulty: 5
  });
  assert.equal(dodge.stat, "speed");
  assert.equal(dodge.armorModifier, -2);
  assert.equal(dodge.defenseType, "dodge");
});

test("_shieldAbsorbWound cascades a full minor shield wound into moderate", async () => {
  let update;
  const shield = {
    name: "Shield",
    system: {
      wounds: {
        minor: { current: 3, max: 3 },
        moderate: { current: 0, max: 2 },
        major: { current: 0, max: 1 }
      }
    },
    update: async changes => { update = changes; }
  };
  const actor = {
    type: "pc",
    name: "Test PC"
  };

  await CypherActor.prototype._shieldAbsorbWound.call(actor, shield, "minor");

  assert.deepEqual(update, { "system.wounds.moderate.current": 1 });
});

test("usePlayerIntrusion spends XP only when the intrusion is accepted", async () => {
  let spent = 0;
  let message;
  const actor = {
    id: "actor-1",
    type: "pc",
    system: { xp: 1 },
    async update(changes) {
      spent += 1;
      this.system.xp = changes["system.xp"];
    }
  };
  const originalCreate = ChatMessage.create;
  ChatMessage.create = async data => { message = data; };

  try {
    await CypherActor.prototype.usePlayerIntrusion.call(actor, "Find a hidden passage.");
  } finally {
    ChatMessage.create = originalCreate;
  }

  assert.equal(spent, 1);
  assert.match(message.content, /Find a hidden passage/);
});

test("damageArmor caps armor damage at its base Block bonus and repairArmor clears it", async () => {
  let armorUpdate;
  const armor = {
    system: { blockEaseDamage: 1 },
    update: async changes => { armorUpdate = changes; }
  };
  const actor = {
    type: "pc",
    name: "Test PC",
    system: {
      armor: { itemId: "armor-1", baseBlockEase: 2 }
    },
    items: new Map([["armor-1", armor]])
  };

  await CypherActor.prototype.damageArmor.call(actor, 5);
  assert.deepEqual(armorUpdate, { "system.blockEaseDamage": 2 });

  await CypherActor.prototype.repairArmor.call(actor);
  assert.deepEqual(armorUpdate, { "system.blockEaseDamage": 0 });
});

test("NPC damage uses armor before reducing health and can ignore armor", async () => {
  const updates = [];
  const actor = {
    type: "npc",
    system: { armor: 2, health: { value: 10, max: 10 } },
    _applyNpcDamage: CypherActor.prototype._applyNpcDamage,
    update: async changes => {
      updates.push(changes);
      actor.system.health.value = changes["system.health.value"];
    }
  };

  assert.equal(await CypherActor.prototype.applyDamage.call(actor, 5), 3);
  assert.equal(actor.system.health.value, 7);

  assert.equal(
    await CypherActor.prototype.applyDamage.call(actor, 5, { ignoreArmor: true }),
    5
  );
  assert.equal(actor.system.health.value, 2);
  assert.deepEqual(updates, [
    { "system.health.value": 7 },
    { "system.health.value": 2 }
  ]);
});

test("custom stats and fields reject invalid PC additions and preserve valid values", async () => {
  const updates = [];
  globalThis.foundry.utils = { randomID: length => "abc123" };
  globalThis.ui = { notifications: { warn() {} } };

  const actor = {
    type: "pc",
    system: {
      customStats: [],
      customFields: []
    },
    async update(changes) {
      updates.push(changes);
      Object.assign(this.system, {
        customStats: changes["system.customStats"] ?? this.system.customStats,
        customFields: changes["system.customFields"] ?? this.system.customFields
      });
    }
  };

  await CypherActor.prototype.addCustomStat.call(actor, "  Favour  ");
  assert.deepEqual(actor.system.customStats, [{
    id: "favour",
    label: "Favour",
    pool: { max: 8, value: 8 },
    edge: 0
  }]);

  await CypherActor.prototype.addCustomStat.call(actor, "Favour");
  assert.equal(updates.length, 1);

  await CypherActor.prototype.addCustomField.call(actor, " Reputation ", "invalid");
  assert.deepEqual(actor.system.customFields, [{
    id: "field-abc123",
    label: "Reputation",
    fieldType: "text",
    valueText: "",
    valueNumber: 0,
    valueBoolean: false
  }]);
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
    _advanceTier: CypherActor.prototype._advanceTier,
    _syncWoundStatusEffects: CypherActor.prototype._syncWoundStatusEffects,
    updates,
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(changes) {
      updates.push(changes);
      applyUpdate(this, changes);
    },
    async spendXP(amount) {
      if (this.system.xp < amount) return false;
      this.system.xp -= amount;
      return true;
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

function applyUpdate(target, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const segments = path.split(".");
    let cursor = target;
    for (const segment of segments.slice(0, -1)) cursor = cursor[segment] ??= {};
    cursor[segments.at(-1)] = value;
  }
}

test("advancement purchases capabilities and applies only the requested pool increases", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = makeAdvancementActor({ type: "capabilities" });
  await CypherActor.prototype.purchaseAdvancementSlot.call(actor, 0, {
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

  await CypherActor.prototype.purchaseAdvancementSlot.call(actor, 0, { stat: "speed" });

  assert.equal(actor.system.stats.speed.edge, 3);
  assert.equal(actor.system.stats.might.edge, 0);
  assert.equal(actor.system.xp, 6);
});

test("advancement increases Effort but caps it at six", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = makeAdvancementActor({ type: "effort" }, { effort: 6 });
  await CypherActor.prototype.purchaseAdvancementSlot.call(actor, 0);

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

  await CypherActor.prototype.purchaseAdvancementSlot.call(actor, 0, { skillId: skill.id });
  assert.equal(skill.system.level, "trained");

  actor.system.advancementSlots[0] = {
    type: "skill", otherType: "", bought: false
  };
  await CypherActor.prototype.purchaseAdvancementSlot.call(actor, 0, {
    newSkillName: "Lore"
  });

  assert.equal(actor.items.get("lore").system.level, "trained");
});

test("Other advancements grant recovery, armor, and weapon permissions", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const recovery = makeAdvancementActor({ type: "other", otherType: "recovery" });
  await CypherActor.prototype.purchaseAdvancementSlot.call(recovery, 0);
  assert.equal(recovery.system.recoveryBonus, 2);

  const armor = makeAdvancementActor({ type: "other", otherType: "armor" });
  await CypherActor.prototype.purchaseAdvancementSlot.call(armor, 0);
  assert.deepEqual(armor.system.freeArmorCategories, ["light", "medium", "heavy"]);
  assert.equal(armor.system.canFreelyUseAllArmor, true);

  const weapons = makeAdvancementActor({ type: "other", otherType: "weapons" });
  await CypherActor.prototype.purchaseAdvancementSlot.call(weapons, 0);
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

  await CypherActor.prototype.purchaseAdvancementSlot.call(actor, 3);

  assert.equal(actor.system.tier, 2);
  assert.equal(actor.system.advancementSlots.length, 4);
  assert.ok(actor.system.advancementSlots.every(slot => !slot.bought));
  assert.equal(actor.flags.cypher.focusAbilityPendingTier, 2);
});

test("adding wounds cascades across full tracks and synchronizes Hindered and Dead states", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };

  const statuses = new Set();
  const actor = {
    type: "pc",
    name: "Test",
    system: {
      wounds: {
        minor: { current: 2, max: 2 },
        moderate: { current: 1, max: 1 },
        major: { current: 0, max: 1 }
      },
      hindered: true,
      dead: false
    },
    statuses,
    update: async changes => applyUpdate(actor, changes),
    toggleStatusEffect: async (status, { active }) => {
      if (active) statuses.add(status);
      else statuses.delete(status);
    },
    _syncWoundStatusEffects: CypherActor.prototype._syncWoundStatusEffects
  };

  await CypherActor.prototype.addWound.call(actor, "minor");
  assert.equal(actor.system.wounds.major.current, 1);

  actor.system.hindered = true;
  actor.system.dead = true;
  await CypherActor.prototype._syncWoundStatusEffects.call(actor);
  assert.equal(statuses.has("hindered"), true);
  assert.equal(statuses.has("dead"), true);
});

test("rollRecovery restores Pool with Tier and recovery bonus and clears the correct wounds", async () => {
  let rollMessage;
  globalThis.Roll = class {
    constructor(formula, data) {
      this.formula = formula;
      this.data = data;
    }
    async evaluate() {
      this.total = 9;
      return this;
    }
    async toMessage(data) {
      rollMessage = data;
      return this;
    }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.game = { i18n: { localize: value => value } };

  const actor = {
    type: "pc",
    system: {
      tier: 2,
      recoveryBonus: 1,
      recoveries: { action: false, tenMinutes: false, hour: false, tenHours: false },
      wounds: {
        minor: { current: 2, max: 3 },
        moderate: { current: 1, max: 2 },
        major: { current: 1, max: 1 }
      }
    },
    update: async changes => {
      applyUpdate(actor, changes);
    }
  };

  const roll = await CypherActor.prototype.rollRecovery.call(actor, "hour");

  assert.equal(roll.total, 9);
  assert.equal(roll.formula, "1d6 + @tier + @bonus");
  assert.deepEqual(roll.data, { tier: 2, bonus: 1 });
  assert.equal(actor.system.wounds.moderate.current, 0);
  assert.equal(actor.system.wounds.minor.current, 2);
  assert.equal(actor.system.recoveries.hour, true);
  assert.match(rollMessage.flavor, /CYPHER\.Recovery\.hour/);
});

test("rallyWound spends the correct Might cost and removes one wound", async () => {
  let changes;
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = {
    type: "pc",
    name: "Test PC",
    system: {
      canRallyMajor: false,
      stats: { might: { pool: { value: 6 } } },
      wounds: { minor: { current: 1 }, moderate: { current: 1 }, major: { current: 0 } }
    },
    update: async update => {
      changes = update;
      applyUpdate(actor, update);
    }
  };

  await CypherActor.prototype.rallyWound.call(actor, "moderate");

  assert.deepEqual(changes, {
    "system.stats.might.pool.value": 1,
    "system.wounds.moderate.current": 0
  });
  assert.equal(actor.system.stats.might.pool.value, 1);
  assert.equal(actor.system.wounds.moderate.current, 0);
});

test("rallyWound rejects a major wound outside the Superhero genre", async () => {
  let updateCalled = false;
  globalThis.game = { i18n: { localize: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };

  const actor = {
    type: "pc",
    system: {
      canRallyMajor: false,
      stats: { might: { pool: { value: 20 } } },
      wounds: { minor: { current: 0 }, moderate: { current: 0 }, major: { current: 1 } }
    },
    update: async () => { updateCalled = true; }
  };

  await CypherActor.prototype.rallyWound.call(actor, "major");

  assert.equal(updateCalled, false);
});

test("validateAdvancementChoices rejects capability distributions that do not total four", () => {
  assert.equal(
    validateAdvancementChoices(
      { type: "capabilities" },
      { distribution: { might: 2, speed: 1, intellect: 0 } }
    ),
    "CYPHER.Warning.CapabilitiesMustSumFour"
  );
  assert.equal(
    validateAdvancementChoices(
      { type: "capabilities" },
      { distribution: { might: 2, speed: 1, intellect: 1 } }
    ),
    null
  );
});
