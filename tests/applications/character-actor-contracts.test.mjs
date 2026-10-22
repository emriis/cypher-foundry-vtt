/** Direct character service contracts relocated from the Actor compatibility suite. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { usePlayerIntrusion, addCustomStat, addCustomField } from "../../module/applications/character-service.mjs";

beforeEach(() => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  delete globalThis.fromUuid;
});
beforeEach(() => { globalThis.foundry = { utils: { randomID: () => "abc123", escapeHTML: value => value } }; });
test("a Player Intrusion creates a pending request without spending its XP", async () => {
  let spent = 0;
  let message;
  const actor = {
    id: "actor-1", uuid: "Actor.actor-1",
    type: "pc",
    system: { xp: 1 },
    async update(changes) {
      spent += 1;
      this.system.xp = changes["system.xp"];
    }
  };
  game.user = { id: "player", isGM: false };
  const originalCreate = ChatMessage.create;
  ChatMessage.create = async data => { message = data; };

  try {
    await usePlayerIntrusion(actor, "Find a hidden passage.");
  } finally {
    ChatMessage.create = originalCreate;
  }

  assert.equal(spent, 0);
  assert.equal(message.flags.cypher.intrusion.state, "pending");
  assert.match(message.content, /Find a hidden passage/);
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

  await addCustomStat(actor, "  Favour  ");
  assert.deepEqual(actor.system.customStats, [{
    id: "favour",
    label: "Favour",
    pool: { max: 8, value: 8 },
    edge: 0
  }]);

  await addCustomStat(actor, "Favour");
  assert.equal(updates.length, 1);

  await addCustomField(actor, " Reputation ", "invalid");
  assert.deepEqual(actor.system.customFields, [{
    id: "field-abc123",
    label: "Reputation",
    fieldType: "text",
    valueText: "",
    valueNumber: 0,
    valueBoolean: false
  }]);
});
