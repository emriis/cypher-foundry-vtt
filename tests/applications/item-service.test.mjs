import assert from "node:assert/strict";
import test from "node:test";

import {
  rollAttack,
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
