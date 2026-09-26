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
