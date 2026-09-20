import assert from "node:assert/strict";
import test from "node:test";

globalThis.Actor = class Actor {};
globalThis.Item = class Item {};
globalThis.game = {
  i18n: {
    localize: key => key,
    format: (key, data) => `${key}:${data.name ?? data.amount ?? data.reason ?? ""}`
  }
};
globalThis.ui = { notifications: { error() {}, warn() {}, info() {} } };
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor?.id ?? null }),
  create: async () => {}
};

const { default: CypherActor } = await import("../module/documents/actor.mjs");
const { default: CypherItem } = await import("../module/documents/item.mjs");

function applyUpdate(target, updates) {
  for (const [path, value] of Object.entries(updates)) {
    const parts = path.split(".");
    let cursor = target;
    for (const part of parts.slice(0, -1)) cursor = cursor[part];
    cursor[parts.at(-1)] = value;
  }
}

test("spendXP updates a PC and refuses an insufficient balance", async () => {
  const updates = [];
  const actor = {
    type: "pc",
    system: { xp: 2 },
    update: async changes => { updates.push(changes); applyUpdate(actor, changes); }
  };

  assert.equal(await CypherActor.prototype.spendXP.call(actor, 1, "reroll"), true);
  assert.equal(actor.system.xp, 1);
  assert.deepEqual(updates, [{ "system.xp": 1 }]);
  assert.equal(await CypherActor.prototype.spendXP.call(actor, 2, "reroll"), false);
  assert.equal(updates.length, 1);
});

test("applyDamage converts pool overflow into a wound and synchronizes statuses", async () => {
  const updates = [];
  const statuses = new Set();
  const actor = {
    type: "pc",
    system: {
      stats: { might: { pool: { value: 3, max: 8 }, edge: 0 } },
      customStats: [],
      wounds: { minor: { current: 0, max: 3 }, moderate: { current: 0, max: 3 }, major: { current: 0, max: 3 } },
      hindered: false,
      dead: false
    },
    statuses,
    _resolveStat: CypherActor.prototype._resolveStat,
    _convertDamageToWound: CypherActor.prototype._convertDamageToWound,
    addWound: CypherActor.prototype.addWound,
    _syncWoundStatusEffects: CypherActor.prototype._syncWoundStatusEffects,
    update: async changes => { updates.push(changes); applyUpdate(actor, changes); },
    toggleStatusEffect: async (status, { active }) => active ? statuses.add(status) : statuses.delete(status)
  };

  await CypherActor.prototype.applyDamage.call(actor, 8, { stat: "might" });

  assert.equal(actor.system.stats.might.pool.value, 0);
  assert.equal(actor.system.wounds.moderate.current, 1);
  assert.deepEqual(updates, [
    { "system.stats.might.pool.value": 0 },
    { "system.wounds.moderate.current": 1 }
  ]);
});

test("rollAttack delegates weapon familiarity and damage to the actor task roll", async () => {
  let received;
  const item = {
    type: "attack",
    name: "Sword",
    system: { damage: 4, attackType: "medium", stat: "might", freelyUsable: false },
    actor: {
      system: { canFreelyUseAllWeapons: false },
      rollTask: async options => { received = options; return "rolled"; }
    }
  };

  assert.equal(await CypherItem.prototype.rollAttack.call(item, { difficulty: 2 }), "rolled");
  assert.equal(received.stat, "might");
  assert.equal(received.baseDamage, 4);
  assert.equal(received.extraHinderSteps, 1);
  assert.equal(received.difficulty, 2);
});

test("useCypher depletes the item and creates a chat message", async () => {
  let update;
  let message;
  const originalCreate = ChatMessage.create;
  ChatMessage.create = async data => { message = data; };
  const item = {
    type: "cypher",
    name: "Ghost Lens",
    actor: { id: "actor-1" },
    update: async changes => { update = changes; }
  };

  try {
    await CypherItem.prototype.useCypher.call(item);
  } finally {
    ChatMessage.create = originalCreate;
  }

  assert.deepEqual(update, { "system.depleted": true });
  assert.match(message.content, /Ghost Lens/);
});