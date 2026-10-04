// Exercises Actor and Item document actions with small Foundry API stubs.
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

const { default: CypherActor } = await import("../../module/documents/actor.mjs");
const { default: CypherItem } = await import("../../module/documents/item.mjs");

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

test("light weapons use the Core Character baseline and ease their attack", async () => {
  let received;
  const item = {
    type: "attack",
    name: "Knife",
    system: { damage: 2, attackType: "light", stat: "speed", freelyUsable: false },
    actor: {
      system: {
        freeWeaponCategories: ["light"],
        freeWeaponFamilies: [],
        canFreelyUseAllWeapons: false
      },
      rollTask: async options => { received = options; return "rolled"; }
    }
  };

  await CypherItem.prototype.rollAttack.call(item);

  assert.equal(received.extraHinderSteps, 0);
  assert.equal(received.extraEaseSteps, 1);
  assert.equal(received.baseDamage, 2);
});

test("a practiced skill for the exact attack category cancels unfamiliar-weapon hindrance", async () => {
  let received;
  const item = {
    type: "attack",
    name: "Broadsword",
    system: {
      damage: 4,
      attackType: "medium",
      attackSkillCategory: "mediumBladed",
      weaponFamily: "swords",
      stat: "might",
      freelyUsable: false
    },
    actor: {
      system: {
        freeWeaponCategories: ["light"],
        freeWeaponFamilies: [],
        canFreelyUseAllWeapons: false
      },
      items: new Map([[
        "medium-blades",
        { type: "skill", system: { level: "practiced", attackCategory: "mediumBladed", stepModifier: 0 } }
      ]]),
      rollTask: async options => { received = options; return "rolled"; }
    }
  };

  await CypherItem.prototype.rollAttack.call(item, { skillItemId: "medium-blades" });

  assert.equal(received.extraHinderSteps, 0);
  assert.equal(received.extraEaseSteps, 0);
});

test("Weapon Master familiarity applies only to its selected attack category", async () => {
  let received;
  const actor = {
    system: {
      freeWeaponCategories: ["light"],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: ["mediumBladed"],
      canFreelyUseAllWeapons: false
    },
    rollTask: async options => { received = options; return "rolled"; }
  };
  const item = {
    type: "attack",
    name: "Broadsword",
    system: {
      damage: 4,
      attackType: "medium",
      attackSkillCategory: "mediumBladed",
      weaponFamily: "swords",
      stat: "might",
      freelyUsable: false
    },
    actor
  };

  await CypherItem.prototype.rollAttack.call(item);
  assert.equal(received.extraHinderSteps, 0);

  item.system.attackSkillCategory = "mediumRanged";
  item.system.weaponFamily = "firearms";
  await CypherItem.prototype.rollAttack.call(item);
  assert.equal(received.extraHinderSteps, 1);
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

test("rollDepletion marks depleted artifacts when the roll reaches the threshold", async () => {
  let update;
  let message;
  const originalCreate = ChatMessage.create;
  globalThis.Roll = class {
    async evaluate() {
      this.total = 1;
      return this;
    }
    async toMessage(data) {
      message = data;
      return this;
    }
  };
  ChatMessage.create = async data => { message = data; };

  const item = {
    type: "artifact",
    id: "artifact-1",
    name: "Ancient Lens",
    actor: { id: "actor-1" },
    system: { depletionDie: "d6", depletionThreshold: 2 },
    update: async changes => { update = changes; }
  };

  try {
    await CypherItem.prototype.rollDepletion.call(item);
  } finally {
    ChatMessage.create = originalCreate;
  }

  assert.deepEqual(update, { "system.depleted": true });
  assert.equal(message.flags.cypher.rollType, "depletion");
  assert.equal(message.flags.cypher.originalRoll, 1);
});

test("rollDepletion does not deplete when the roll is above the threshold", async () => {
  let updateCalled = false;
  let message;
  const originalCreate = ChatMessage.create;
  globalThis.Roll = class {
    async evaluate() {
      this.total = 6;
      return this;
    }
    async toMessage(data) {
      message = data;
      return this;
    }
  };
  ChatMessage.create = async data => { message = data; };

  const item = {
    type: "equipment",
    id: "equipment-1",
    name: "Tool",
    actor: { id: "actor-1" },
    system: { depletionDie: "d6", depletionThreshold: 2 },
    update: async () => { updateCalled = true; }
  };

  try {
    await CypherItem.prototype.rollDepletion.call(item);
  } finally {
    ChatMessage.create = originalCreate;
  }

  assert.equal(updateCalled, false);
  assert.equal(message.flags.cypher.originalRoll, 6);
});

test("rollDefense integration applies a wound on a failed defense", async () => {
  const actor = {
    type: "pc",
    system: {
      effort: 1,
      hinderSteps: 0,
      armor: { blockEase: 0, dodgeHinder: 0 },
      stats: {
        might: { pool: { value: 8, max: 8 }, edge: 0 },
        speed: { pool: { value: 8, max: 8 }, edge: 0 },
        intellect: { pool: { value: 8, max: 8 }, edge: 0 }
      },
      wounds: {
        minor: { current: 0, max: 3 },
        moderate: { current: 0, max: 3 },
        major: { current: 0, max: 3 }
      },
      customStats: []
    },
    items: new Map(),
    updates: [],
    update: async changes => {
      actor.updates.push(changes);
      applyUpdate(actor, changes);
    },
    toggleStatusEffect: async () => {}
  };

  globalThis.Roll = class {
    async evaluate() {
      this.total = 1;
      return this;
    }
    async toMessage() { return this; }
  };

  actor.rollTask = CypherActor.prototype.rollTask;
    const result = await CypherActor.prototype.rollDefense.call(actor, "dodge", {
    difficulty: 3,
    incomingSeverity: "moderate"
  });

  assert.equal(result.success, false);
  assert.equal(actor.system.wounds.moderate.current, 1);
});
