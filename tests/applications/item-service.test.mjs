import assert from "node:assert/strict";
import test from "node:test";

import {
  rollAttack,
  rollCypherTable,
  rollCypherVariant,
  rollDepletion,
  useCypher
} from "../../module/applications/item-service.mjs";

test("useCypher depletes the item and posts a message", async () => {
  let update;
  let message;
  globalThis.game = { i18n: { localize: value => value } };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async value => { message = value; }
  };

  const item = {
    type: "cypher",
    name: "Teleport",
    actor: {},
    system: { depleted: false },
    async update(value) { update = value; }
  };

  assert.equal(await useCypher(item), true);
  assert.deepEqual(update, { "system.depleted": true });
  assert.match(message.content, /Teleport/);
});

test("rollCypherTable resolves the matching result and consumes the Cypher", async () => {
  let update;
  let message;
  globalThis.game = { i18n: { localize: value => value } };
  globalThis.ui = { notifications: { error: () => {} } };
  globalThis.foundry = {
    applications: {
      ux: {
        TextEditor: {
          implementation: {
            enrichHTML: async value => `<p>${value}</p>`
          }
        }
      }
    }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { this.total = 4; return this; }
    async toMessage(value) { message = value; }
  };

  const item = {
    type: "cypher",
    id: "cypher-id",
    name: "Table Cypher",
    actor: { id: "actor-id" },
    system: {
      depleted: false,
      rollTables: [{
        id: "effect-table",
        name: "Effect Table",
        formula: "1d6",
        results: [
          { min: 1, max: 3, description: "Minor result" },
          { min: 4, max: 6, description: "Major result" }
        ]
      }]
    },
    async update(value) { update = value; }
  };

  assert.equal(await rollCypherTable(item, "effect-table"), true);
  assert.deepEqual(update, { "system.depleted": true });
  assert.match(message.flavor, /Effect Table/);
  assert.match(message.flavor, /Major result/);
  assert.equal(message.flags.cypher.rollType, "cypherTable");
  assert.equal(message.flags.cypher.tableId, "effect-table");
  assert.equal(message.flags.cypher.originalRoll, 4);
});


test("rollCypherVariant resolves the matching power and consumes the Cypher", async () => {
  let update;
  let message;
  globalThis.game = { i18n: { localize: value => value } };
  globalThis.ui = { notifications: { error: () => {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { this.total = 75; return this; }
    async toMessage(value) { message = value; }
  };

  const item = {
    type: "cypher",
    id: "teleporter-id",
    name: "Teleporter",
    actor: { id: "actor-id" },
    system: {
      depleted: false,
      variants: [
        { name: "Bounder", powerLevel: "medium", rollMin: 1, rollMax: 50 },
        { name: "Traveler", powerLevel: "advanced", rollMin: 51, rollMax: 80 },
        { name: "Planetary", powerLevel: "high", rollMin: 81, rollMax: 95 },
        { name: "Interstellar", powerLevel: "ultra", rollMin: 96, rollMax: 100 }
      ]
    },
    async update(value) { update = value; }
  };

  assert.equal(await rollCypherVariant(item), true);
  assert.deepEqual(update, { "system.depleted": true });
  assert.match(message.flavor, /Traveler/);
  assert.match(message.flavor, /advanced/);
  assert.equal(message.flags.cypher.rollType, "cypherVariant");
  assert.equal(message.flags.cypher.originalRoll, 75);
});

test("rollCypherVariant leaves the Cypher untouched when no variant matches", async () => {
  let updateCalled = false;
  globalThis.game = { i18n: { localize: value => value } };
  globalThis.ui = { notifications: { error: () => {} } };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { this.total = 75; return this; }
  };
  const item = {
    type: "cypher",
    actor: { id: "actor-id" },
    system: {
      depleted: false,
      variants: [{ name: "Bounder", powerLevel: "medium", rollMin: 1, rollMax: 50 }]
    },
    async update() { updateCalled = true; }
  };

  assert.equal(await rollCypherVariant(item), false);
  assert.equal(updateCalled, false);
});

test("rollCypherTable rejects missing tables and already-depleted Cyphers", async () => {
  let updateCalled = false;
  const item = {
    type: "cypher",
    id: "cypher-id",
    name: "Spent Cypher",
    actor: { id: "actor-id" },
    system: { depleted: true, rollTables: [] },
    async update() { updateCalled = true; }
  };

  assert.equal(await rollCypherTable(item, "missing"), false);
  assert.equal(updateCalled, false);
});

test("rollAttack delegates weapon familiarity to the common task service", async () => {
  let received;
  globalThis.game = { i18n: { localize: value => value } };

  const actor = {
    system: {
      freeWeaponCategories: [],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: [],
      canFreelyUseAllWeapons: false
    },
    items: new Map(),
    async rollTask(options) {
      received = options;
      return options;
    }
  };
  const item = {
    type: "attack",
    name: "Sword",
    actor,
    system: {
      damage: 4,
      attackType: "medium",
      attackSkillCategory: "martial",
      weaponFamily: "swords",
      attackSkillCategory: "martial",
      stat: "might",
      freelyUsable: false
    }
  };

  await rollAttack(item);
  assert.equal(received.extraHinderSteps, 1);
  assert.equal(received.extraEaseSteps, 0);
  assert.equal(received.baseDamage, 4);
});

test("rollAttack hinders a weapon explicitly used one-handed", async () => {
  let received;
  globalThis.game = {
    i18n: { localize: value => value },
    user: { targets: new Set() }
  };
  const actor = {
    system: {
      freeWeaponCategories: ["medium"],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: [],
      canFreelyUseAllWeapons: false
    },
    items: new Map(),
    async rollTask(options) {
      received = options;
      return options;
    }
  };
  const item = {
    type: "attack",
    name: "Rifle",
    actor,
    system: {
      damage: 4,
      attackType: "medium",
      stat: "might",
      freelyUsable: false,
      mechanics: { hinderedWhenUsedOneHanded: true }
    }
  };

  await rollAttack(item, { oneHanded: true });
  assert.equal(received.extraHinderSteps, 1);
  await rollAttack(item, { oneHanded: false });
  assert.equal(received.extraHinderSteps, 0);
});

test("rollAttack resolves target effects from the selected NPC level", async () => {
  let received;
  globalThis.game = {
    i18n: { localize: value => value },
    user: { targets: new Set() }
  };

  const actor = {
    system: {
      freeWeaponCategories: [],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: [],
      canFreelyUseAllWeapons: false
    },
    items: new Map(),
    async rollTask(options) {
      received = options;
      return options;
    }
  };
  const target = {
    type: "npc",
    system: { level: 2 }
  };
  const item = {
    type: "attack",
    name: "Stunner",
    actor,
    system: {
      damage: 4,
      attackType: "medium",
      weaponFamily: "swords",
      attackSkillCategory: "martial",
      stat: "might",
      freelyUsable: true,
      mechanics: {
        targetEffects: [{
          minimumTargetLevel: 0,
          maximumTargetLevel: 2,
          effect: "loseNextAction",
          hinderSteps: 0,
          duration: "next action"
        }]
      }
    }
  };

  await rollAttack(item, { target });
  assert.deepEqual(received.weaponTargetEffects, item.system.mechanics.targetEffects);
});


test("rollAttack passes the selected NPC target and Armor bypass to task resolution", async () => {
  let received;
  globalThis.game = { i18n: { localize: value => value }, user: { targets: new Set() } };

  const actor = {
    system: {
      freeWeaponCategories: [],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: [],
      canFreelyUseAllWeapons: false
    },
    items: new Map(),
    async rollTask(options) {
      received = options;
      return options;
    }
  };
  const target = {
    type: "npc",
    system: { level: 4, armor: 4 }
  };
  const item = {
    type: "attack",
    name: "Armor Piercer",
    actor,
    system: {
      damage: 6,
      attackType: "heavy",
      weaponFamily: "ranged",
      attackSkillCategory: "ranged",
      stat: "might",
      freelyUsable: true,
      mechanics: {
        ignoresPhysicalArmor: 2,
        targetEffects: []
      }
    }
  };

  await rollAttack(item, { target });

  assert.equal(received.targetActor, target);
  assert.equal(received.armorBypass, 2);
});

test("rollDepletion marks a depleting item and posts a rerollable result", async () => {
  let update;
  let message;
  globalThis.game = {
    i18n: {
      localize: value => value,
      format: (value, data) => `${value}:${data.name ?? data.threshold ?? ""}`
    }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    constructor() { this.total = 1; }
    async evaluate() { return this; }
    async toMessage(value) { message = value; }
  };

  const item = {
    type: "artifact",
    id: "artifact",
    name: "Artifact",
    actor: { id: "actor" },
    system: { depletionDie: "d6", depletionMin: 1, depletionMax: 1 },
    async update(value) { update = value; }
  };

  assert.equal(await rollDepletion(item), true);
  assert.deepEqual(update, { "system.depleted": true });
  assert.equal(message.flags.cypher.rerollable, true);
  assert.equal(message.flags.cypher.depletionMin, 1);
  assert.equal(message.flags.cypher.depletionMax, 1);
});


test("rollDepletion depletes only inside an inclusive depletion range", async () => {
  let updateCalled = false;
  globalThis.game = {
    i18n: {
      localize: value => value,
      format: (value, data) => `${value}:${data.threshold ?? data.name ?? ""}`
    }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    async evaluate() {
      this.total = 3;
      return this;
    }
    async toMessage(data) { return data; }
  };

  const item = {
    type: "artifact",
    name: "Range Artifact",
    actor: { id: "actor" },
    system: { depletionDie: "d20", depletionMin: 2, depletionMax: 4 },
    update: async () => { updateCalled = true; }
  };

  assert.equal(await rollDepletion(item), true);
  assert.equal(updateCalled, true);
});

test("rollDepletion leaves an item intact outside its depletion range", async () => {
  let updateCalled = false;
  globalThis.Roll = class {
    async evaluate() {
      this.total = 5;
      return this;
    }
    async toMessage(data) { return data; }
  };

  const item = {
    type: "equipment",
    name: "Range Equipment",
    actor: { id: "actor" },
    system: { depletionDie: "d20", depletionMin: 2, depletionMax: 4 },
    update: async () => { updateCalled = true; }
  };

  assert.equal(await rollDepletion(item), true);
  assert.equal(updateCalled, false);
});


test("rollAttack applies trained attack skill after unfamiliar weapon cancellation", async () => {
  let received;
  globalThis.game = { i18n: { localize: value => value } };

  const skill = {
    type: "skill",
    system: {
      attackCategory: "mediumBladed",
      level: "trained"
    }
  };
  const actor = {
    system: {
      freeWeaponCategories: [],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: [],
      canFreelyUseAllWeapons: false
    },
    items: new Map([["skill", skill]]),
    async rollTask(options) {
      received = options;
      return options;
    }
  };
  const item = {
    type: "attack",
    name: "Sword",
    actor,
    system: {
      damage: 4,
      attackType: "medium",
      attackSkillCategory: "mediumBladed",
      weaponFamily: "swords",
      stat: "might",
      freelyUsable: false
    }
  };

  await rollAttack(item, { skillItemId: "skill" });

  assert.equal(received.extraHinderSteps, 0);
  assert.equal(received.extraEaseSteps, 0);
});

test("rollAttack applies specialized weapon skill as one remaining ease when unfamiliar", async () => {
  let received;
  globalThis.game = { i18n: { localize: value => value } };

  const skill = {
    type: "skill",
    system: {
      attackCategory: "mediumBladed",
      level: "specialized"
    }
  };
  const actor = {
    system: {
      freeWeaponCategories: [],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: [],
      canFreelyUseAllWeapons: false
    },
    items: new Map([["skill", skill]]),
    async rollTask(options) {
      received = options;
      return options;
    }
  };
  const item = {
    type: "attack",
    name: "Sword",
    actor,
    system: {
      damage: 4,
      attackType: "medium",
      attackSkillCategory: "mediumBladed",
      weaponFamily: "swords",
      stat: "might",
      freelyUsable: false
    }
  };

  await rollAttack(item, { skillItemId: "skill" });

  assert.equal(received.extraHinderSteps, 0);
  assert.equal(received.extraEaseSteps, 1);
});

test("rollAttack does not double-count an explicit inability skill", async () => {
  let received;
  globalThis.game = { i18n: { localize: value => value } };

  const skill = {
    type: "skill",
    system: {
      attackCategory: "mediumBladed",
      level: "inability"
    }
  };
  const actor = {
    system: {
      freeWeaponCategories: [],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: [],
      canFreelyUseAllWeapons: false
    },
    items: new Map([["skill", skill]]),
    async rollTask(options) {
      received = options;
      return options;
    }
  };
  const item = {
    type: "attack",
    name: "Sword",
    actor,
    system: {
      damage: 4,
      attackType: "medium",
      attackSkillCategory: "mediumBladed",
      weaponFamily: "swords",
      stat: "might",
      freelyUsable: false
    }
  };

  await rollAttack(item, { skillItemId: "skill" });

  assert.equal(received.extraHinderSteps, 1);
  assert.equal(received.extraEaseSteps, 0);
});


test("rollAttack applies and forwards explicitly adjudicated extreme range", async () => {
  let received;
  globalThis.game = {
    i18n: { localize: value => value },
    user: { targets: new Set() }
  };
  const actor = {
    system: {
      freeWeaponCategories: ["medium"],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: [],
      canFreelyUseAllWeapons: false
    },
    items: new Map(),
    async rollTask(options) {
      received = options;
      return options;
    }
  };
  const item = {
    type: "attack",
    name: "Range Test Rifle",
    actor,
    system: {
      range: "long",
      extremeRange: "",
      attackType: "medium",
      damage: 4,
      stat: "might",
      freelyUsable: true
    }
  };

  await rollAttack(item, { difficulty: 2, atExtremeRange: false });
  assert.equal(received.extraHinderSteps, 0);
  assert.deepEqual(received.weaponRangeAdjudication, {
    range: "long",
    extremeRange: null,
    atExtremeRange: false,
    hinderSteps: 0
  });

  await rollAttack(item, { difficulty: 2, atExtremeRange: true });
  assert.equal(received.extraHinderSteps, 1);
  assert.deepEqual(received.weaponRangeAdjudication, {
    range: "long",
    extremeRange: null,
    atExtremeRange: true,
    hinderSteps: 1
  });
});
