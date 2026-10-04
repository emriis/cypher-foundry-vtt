// Tests task-roll calculations and outcomes with deterministic Foundry and dice stubs.
import assert from "node:assert/strict";
import test from "node:test";

globalThis.Actor = class Actor {};
globalThis.game = {
  i18n: {
    localize: key => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  }
};
globalThis.ui = { notifications: { error() {}, warn() {} } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.__rollMessages = [];

const { default: CypherActor } = await import("../module/documents/actor.mjs");

function createActor({ type = "pc", pool = 10, max = 10, edge = 0, effort = 6 } = {}) {
  const actor = {
    id: "actor-1",
    type,
    system: {
      effort,
      hinderSteps: 0,
      armor: { speedTaskHinder: 0 },
      stats: {
        might: { pool: { value: pool, max }, edge },
        speed: { pool: { value: pool, max }, edge: 0 },
        intellect: { pool: { value: pool, max }, edge: 0 }
      },
      customStats: []
    },
    _resolveStat: CypherActor.prototype._resolveStat,
    items: new Map(),
    updates: [],
    messages: [],
    async update(changes) {
      this.updates.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split(".");
        let target = this;
        for (const part of parts.slice(0, -1)) target = target[part];
        target[parts.at(-1)] = value;
      }
    }
  };

  return actor;
}

function setRollResult(value) {
  globalThis.Roll = class {
    constructor(formula) {
      this.formula = formula;
    }

    async evaluate() {
      this.total = value;
      return this;
    }

    async toMessage(message) {
      this.message = message;
      globalThis.__rollMessages.push(message);
      return message;
    }
  };
}

test("rollTask caps assets and Effort before resolving difficulty and Pool cost", async () => {
  setRollResult(6);
  globalThis.__rollMessages = [];
  const actor = createActor({ pool: 10, edge: 1, effort: 2 });
  actor.system.hinderSteps = 1;
  actor.items.set("trained", { system: { stepModifier: 1 } });

  const result = await CypherActor.prototype.rollTask.call(actor, {
    stat: "might",
    difficulty: 6,
    effortLevels: 5,
    assetSteps: 4,
    skillItemId: "trained"
  });

  assert.equal(result.success, true);
  assert.equal(result.effectiveDifficulty, 2);
  assert.equal(result.targetNumber, 6);
  assert.equal(actor.system.stats.might.pool.value, 6);
  assert.equal(actor.updates.length, 1);
  assert.equal(globalThis.__rollMessages.length, 1);
});

test("rollTask refunds Effort cost on a natural 20 and reports attack damage", async () => {
  setRollResult(20);
  globalThis.__rollMessages = [];
  const actor = createActor({ pool: 9, max: 10, edge: 1 });

  const result = await CypherActor.prototype.rollTask.call(actor, {
    stat: "might",
    difficulty: 3,
    effortLevels: 2,
    isAttack: true,
    baseDamage: 4
  });

  assert.equal(result.damage, 8);
  assert.equal(actor.system.stats.might.pool.value, 9);
  assert.deepEqual(actor.updates, [
    { "system.stats.might.pool.value": 5 },
    { "system.stats.might.pool.value": 9 }
  ]);
  assert.match(globalThis.__rollMessages[0].flavor, /CostRefunded/);
  assert.equal(globalThis.__rollMessages[0].flags.cypher.d20, 20);
});

test("rollTask refuses insufficient Pool before rolling or spending", async () => {
  let evaluated = false;
  globalThis.Roll = class {
    constructor() {}
    async evaluate() {
      evaluated = true;
      return this;
    }
  };
  const actor = createActor({ pool: 2 });

  const result = await CypherActor.prototype.rollTask.call(actor, {
    stat: "might",
    effortLevels: 1
  });

  assert.equal(result, null);
  assert.equal(evaluated, false);
  assert.equal(actor.updates.length, 0);
  assert.equal(actor.system.stats.might.pool.value, 2);
});

test("rollTask rejects non-PC actors without evaluating a roll", async () => {
  let evaluated = false;
  globalThis.Roll = class {
    constructor() {}
    async evaluate() {
      evaluated = true;
      return this;
    }
  };
  const actor = createActor({ type: "npc" });

  assert.equal(await CypherActor.prototype.rollTask.call(actor), null);
  assert.equal(evaluated, false);
});


test("rollTask combines Effort, assets, skill, wounds, and armor into the effective difficulty", async () => {
  let rollResult;
  globalThis.Roll = class {
    async evaluate() {
      this.total = 12;
      return this;
    }
    async toMessage(data) {
      rollResult = data;
      return this;
    }
  };

  const actor = {
    type: "pc",
    system: {
      effort: 4,
      hinderSteps: 1,
      armor: { speedTaskHinder: 1 },
      stats: {
        speed: { pool: { value: 10, max: 10 }, edge: 1 }
      },
      customStats: []
    },
    items: new Map([
      ["skill", { type: "skill", system: { stepModifier: 1 } }]
    ]),
    update: async changes => {
      actor.lastUpdate = changes;
      const value = changes["system.stats.speed.pool.value"];
      actor.system.stats.speed.pool.value = value;
    }
  };
  actor._resolveStat = CypherActor.prototype._resolveStat;

  const result = await CypherActor.prototype.rollTask.call(actor, {
    stat: "speed",
    difficulty: 6,
    effortLevels: 2,
    assetSteps: 3,
    skillItemId: "skill"
  });

  assert.equal(result.effectiveDifficulty, 3);
  assert.equal(result.targetNumber, 9);
  assert.equal(result.success, true);
  assert.equal(actor.system.speed.pool.value, 6);
  assert.equal(rollResult.flags.cypher.effectiveDifficulty, 3);
});

test("Lucky Shot spends XP and adds four hindrance steps before rolling", async () => {
  let receivedMessage;
  let spent = 0;
  globalThis.Roll = class {
    async evaluate() {
      this.total = 15;
      return this;
    }
    async toMessage(data) {
      receivedMessage = data;
      return this;
    }
  };

  const actor = {
    type: "pc",
    system: {
      xp: 2,
      effort: 1,
      hinderSteps: 0,
      armor: { speedTaskHinder: 0 },
      stats: { might: { pool: { value: 8, max: 8 }, edge: 0 } },
      customStats: []
    },
    _resolveStat: CypherActor.prototype._resolveStat,
    update: async () => {},
    spendXP: async amount => {
      spent += amount;
      return true;
    }
  };

  await CypherActor.prototype.rollTask.call(actor, {
    stat: "might",
    difficulty: 3,
    luckyShot: true
  });

  assert.equal(spent, 1);
  assert.equal(receivedMessage.flags.cypher.effectiveDifficulty, 7);
});

test("rollTask resolves custom stats by id and keeps their user-facing label", async () => {
  let message;
  globalThis.Roll = class {
    async evaluate() {
      this.total = 18;
      return this;
    }
    async toMessage(data) {
      message = data;
      return this;
    }
  };

  const actor = {
    type: "pc",
    system: {
      effort: 1,
      hinderSteps: 0,
      armor: { speedTaskHinder: 0 },
      stats: {},
      customStats: [
        { id: "willpower", label: "Willpower", pool: { value: 8, max: 8 }, edge: 0 }
      ]
    },
    _resolveStat: CypherActor.prototype._resolveStat,
    update: async () => {}
  };

  const result = await CypherActor.prototype.rollTask.call(actor, {
    stat: "willpower",
    difficulty: 3
  });

  assert.equal(result.success, true);
  assert.match(message.flavor, /Willpower/);
});

test("natural 20 on a non-attack refunds Effort and reports a major effect", async () => {
  const updates = [];
  globalThis.Roll = class {
    async evaluate() {
      this.total = 20;
      return this;
    }
    async toMessage() {
      return this;
    }
  };

  const actor = {
    type: "pc",
    system: {
      effort: 3,
      hinderSteps: 0,
      armor: { speedTaskHinder: 0 },
      stats: {
        might: { pool: { value: 10, max: 10 }, edge: 0 }
      },
      customStats: []
    },
    _resolveStat: CypherActor.prototype._resolveStat,
    update: async changes => updates.push(changes)
  };

  const result = await CypherActor.prototype.rollTask.call(actor, {
    stat: "might",
    difficulty: 3,
    effortLevels: 1
  });

  assert.equal(result.success, true);
  assert.deepEqual(updates, [
    { "system.stats.might.pool.value": 7 },
    { "system.stats.might.pool.value": 10 }
  ]);
});

test("natural 1 records the special result on an otherwise routine task", async () => {
  let message;
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

  const actor = {
    type: "pc",
    system: {
      effort: 1,
      hinderSteps: 0,
      armor: { speedTaskHinder: 0 },
      stats: { might: { pool: { value: 8, max: 8 }, edge: 0 } },
      customStats: []
    },
    _resolveStat: CypherActor.prototype._resolveStat,
    update: async () => {}
  };

  const result = await CypherActor.prototype.rollTask.call(actor, {
    stat: "might",
    difficulty: 1,
    effortLevels: 1
  });

  assert.equal(result.success, true);
  assert.match(message.flavor, /GMIntrusionFree/);
});
