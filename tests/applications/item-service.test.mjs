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
    system: { depletionDie: "d6", depletionThreshold: 1 },
    async update(value) { update = value; }
  };

  assert.equal(await rollDepletion(item), true);
  assert.deepEqual(update, { "system.depleted": true });
  assert.equal(message.flags.cypher.rerollable, true);
});
