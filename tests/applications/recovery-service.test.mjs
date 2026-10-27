// Covers recovery and Rally application-service compatibility facades.
import assert from "node:assert/strict";
import test from "node:test";

globalThis.Actor = class Actor {};
globalThis.game = {
  i18n: {
    localize: key => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  }
};
globalThis.ui = { notifications: { error() {}, info() {}, warn() {} } };
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

const { default: CypherActor } = await import("../../module/documents/actor.mjs");

function applyUpdate(target, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split(".");
    let cursor = target;
    for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
    cursor[parts.at(-1)] = value;
  }
}

function createPc() {
  const actor = {
    type: "pc",
    name: "Test PC",
    flags: { cypher: {} },
    system: {
      tier: 2,
      effort: 1,
      recoveryBonus: 0,
      recoveries: { action: false, tenMinutes: false, hour: false, tenHours: false },
      stats: { might: { pool: { value: 10, max: 10 } } },
      wounds: {
        minor: { current: 2, max: 3 },
        moderate: { current: 2, max: 3 },
        major: { current: 1, max: 3 }
      }
    },
    updates: [],
    messages: [],
    async update(changes) {
      this.updates.push(changes);
      applyUpdate(this, changes);
    }
  };
  return actor;
}

function setRecoveryRoll() {
  globalThis.Roll = class {
    async evaluate() {
      this.total = 5;
      return this;
    }
    async toMessage(message) {
      this.message = message;
      return message;
    }
  };
}

test("rollRecovery removes the interval's wounds and marks the recovery used", async () => {
  setRecoveryRoll();
  const actor = createPc();

  const roll = await CypherActor.prototype.rollRecovery.call(actor, "hour");

  assert.equal(roll.total, 5);
  assert.equal(actor.system.wounds.moderate.current, 1);
  assert.equal(actor.system.wounds.minor.current, 2);
  assert.equal(actor.system.recoveries.hour, true);
  assert.equal(actor.updates.length, 1);
  assert.match(roll.message.flavor, /RemovesOneModerate/);
});

test("rallyWound spends Might only when removing an existing eligible wound", async () => {
  const actor = createPc();
  actor.update = async changes => {
    actor.updates.push(changes);
    applyUpdate(actor, changes);
  };

  await CypherActor.prototype.rallyWound.call(actor, "minor");
  assert.equal(actor.system.stats.might.pool.value, 8);
  assert.equal(actor.system.wounds.minor.current, 1);
  assert.equal(actor.updates.length, 1);

  await CypherActor.prototype.rallyWound.call(actor, "major");
  assert.equal(actor.system.stats.might.pool.value, 8);
  assert.equal(actor.updates.length, 1);
});
test("rollRecovery expires active Ability effects after the recovery is applied", async () => {
  setRecoveryRoll();

  const ability = {
    type: "ability",
    uuid: "Actor.pc.Item.fury",
    system: {
      effects: [{
        id: "fury",
        endConditions: [{
          kind: "recovery",
          interval: "tenMinutes",
          minimum: true
        }]
      }]
    }
  };
  globalThis.fromUuid = async uuid =>
    uuid === ability.uuid ? ability : null;

  const actor = createPc();
  actor.system.activeAbilityEffects = [{
    itemUuid: ability.uuid,
    effectId: "fury"
  }];

  const roll = await CypherActor.prototype.rollRecovery.call(
    actor,
    "hour"
  );

  assert.equal(roll.total, 5);
  assert.deepEqual(actor.system.activeAbilityEffects, []);
  assert.equal(actor.updates.length, 2);
});

test("Given an already used recovery, then rejection rolls no dice and changes no wounds", async () => {
  let rolls = 0;
  globalThis.Roll = class { constructor() { rolls++; } };
  const actor = createPc();
  actor.system.recoveries.hour = true;
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "hour"), null);
  assert.equal(rolls, 0);
  assert.equal(actor.updates.length, 0);
  assert.equal(actor.system.wounds.moderate.current, 2);
});

test("Given a valid recovery, then chosen points are distributed across Pools within their maxima", async () => {
  setRecoveryRoll();
  const actor = createPc();
  actor.system.stats = {
    might: { pool: { value: 4, max: 10 } }, speed: { pool: { value: 7, max: 10 } }, intellect: { pool: { value: 10, max: 10 } }
  };
  await CypherActor.prototype.rollRecovery.call(actor, "action", { allocation: { might: 3, speed: 2, intellect: 0 } });
  assert.equal(actor.system.stats.might.pool.value, 7);
  assert.equal(actor.system.stats.speed.pool.value, 9);
  assert.equal(actor.system.recoveries.action, true);
});

test("Given a cancelled allocation, then no recovery or healing is committed", async () => {
  setRecoveryRoll();
  const actor = createPc();
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "hour", { allocate: async () => null }), null);
  assert.equal(actor.updates.length, 0);
});

test("Given an excessive allocation, then it cannot overfill a Pool or consume a recovery", async () => {
  setRecoveryRoll();
  const actor = createPc();
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "hour", { allocation: { might: 1 } }), null);
  assert.equal(actor.updates.length, 0);
});

test("Given a completed ten-hour recovery, then every interval is available for the new day", async () => {
  setRecoveryRoll();
  const actor = createPc();
  Object.assign(actor.system.recoveries, { action: true, tenMinutes: true, hour: true });
  await CypherActor.prototype.rollRecovery.call(actor, "tenHours");
  assert.deepEqual(actor.system.recoveries, { action: false, tenMinutes: false, hour: false, tenHours: false });
});

test("Given a non-owner or incomplete rest, then recovery performs no writes", async () => {
  const actor = createPc();
  actor.isOwner = false;
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "hour"), null);
  actor.isOwner = true;
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "hour", { completed: false }), null);
  assert.equal(actor.updates.length, 0);
});

test("Given Untamed Recovery, then the extra action recovery is independently limited once per day", async () => {
  setRecoveryRoll();
  const actor = createPc();
  actor.items = [{ type: "ability", system: { key: "untamed-recovery" } }];
  await CypherActor.prototype.rollRecovery.call(actor, "action");
  assert.ok(await CypherActor.prototype.rollRecovery.call(actor, "action", { source: "untamed-recovery" }));
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "action", { source: "untamed-recovery" }), null);
  await CypherActor.prototype.rollRecovery.call(actor, "tenHours");
  assert.ok(await CypherActor.prototype.rollRecovery.call(actor, "action", { source: "untamed-recovery" }));
});

test("Given Mind Surge, then its points cannot replenish Might", async () => {
  setRecoveryRoll();
  const actor = createPc();
  actor.items = [{ type: "ability", system: { key: "mind-surge" } }];
  actor.system.stats.might.pool.value = 0;
  actor.system.stats.intellect = { pool: { value: 0, max: 10 } };
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "action", { source: "mind-surge", allocation: { might: 5 } }), null);
  assert.equal(actor.updates.length, 0);
  await CypherActor.prototype.rollRecovery.call(actor, "action", { source: "mind-surge", allocation: { intellect: 5 } });
  assert.equal(actor.system.stats.intellect.pool.value, 5);
  assert.equal(actor.system.stats.might.pool.value, 0);
});

test("Given Machine Not Flesh, then power confirmation controls its extra recovery and the next day's action recovery", async () => {
  setRecoveryRoll();
  const actor = createPc();
  actor.items = [{ type: "ability", system: { key: "machine-not-flesh" } }];
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "action", { source: "machine-not-flesh" }), null);
  await CypherActor.prototype.rollRecovery.call(actor, "tenHours", { machinePowered: false });
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "action"), null);
  assert.ok(await CypherActor.prototype.rollRecovery.call(actor, "action", { machinePowered: true }));
  assert.equal(actor.flags.cypher.machineRecoveryPowerRequired, false);
});

test("Given a Last action recovery, then its roll includes the CRD's two-point bonus", async () => {
  let data;
  globalThis.Roll = class {
    constructor(_formula, rollData) { data = rollData; }
    async evaluate() { this.total = 7; return this; }
    async toMessage() {}
  };
  const actor = createPc();
  await CypherActor.prototype.rollRecovery.call(actor, "action", { lastAction: true });
  assert.equal(data.bonus, 2);
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "hour", { lastAction: true }), null);
});

test("Given an allocation awaiting input, then a duplicate recovery cannot consume or heal twice", async () => {
  setRecoveryRoll();
  const actor = createPc();
  let complete;
  const pending = CypherActor.prototype.rollRecovery.call(actor, "hour", { allocate: () => new Promise(resolve => { complete = resolve; }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await CypherActor.prototype.rollRecovery.call(actor, "hour"), null);
  complete({});
  await pending;
  assert.equal(actor.system.wounds.moderate.current, 1);
});

test("Given completed long rest, then the optional fixed-difficulty Might task can remove a major wound", async () => {
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() { this.total = this.formula.startsWith("1d6") ? 5 : 20; return this; }
    async toMessage() {}
  };
  const actor = createPc();
  await CypherActor.prototype.rollRecovery.call(actor, "tenHours", { healMajor: true,
    majorTaskOptions: { difficulty: 0 }, woundChoice: "minor" });
  assert.equal(actor.system.wounds.major.current, 0);
  assert.equal(actor.system.wounds.moderate.current, 1);
  assert.equal(actor.system.wounds.minor.current, 0);
});

test("Given Foundry merges flag objects, then completed rest resets existing extra-use and healing counters", async () => {
  setRecoveryRoll();
  const actor = createPc();
  actor.items = [{ type: "ability", system: { key: "untamed-recovery" } }];
  actor.flags.cypher = { additionalRecoveriesUsed: { "untamed-recovery": 1 }, healingUses: { "healing-hand": 2 } };
  const update = actor.update.bind(actor);
  actor.update = async changes => {
    // Foundry recursively merges nested flag maps rather than replacing them.
    const oldExtras = { ...actor.flags.cypher.additionalRecoveriesUsed };
    const oldHealing = { ...actor.flags.cypher.healingUses };
    await update(changes);
    if (changes["flags.cypher.additionalRecoveriesUsed"]) actor.flags.cypher.additionalRecoveriesUsed = {
      ...oldExtras, ...changes["flags.cypher.additionalRecoveriesUsed"]
    };
    if (changes["flags.cypher.healingUses"]) actor.flags.cypher.healingUses = {
      ...oldHealing, ...changes["flags.cypher.healingUses"]
    };
  };
  await CypherActor.prototype.rollRecovery.call(actor, "tenHours");
  assert.equal(actor.flags.cypher.additionalRecoveriesUsed["untamed-recovery"], 0);
  assert.equal(actor.flags.cypher.healingUses["healing-hand"], 0);
});

test("D'nec receives one fixed Intellect point in addition to the roll, without changing its rolled total", async () => {
  setRecoveryRoll(); const actor = createPc(); actor.system.stats.intellect = { pool: { value: 0, max: 10 } };
  actor.items = new Map([["gift", { type: "ability", system: {}, flags: { cypher: { ruleBenefit: { version: 1, id: "descriptor.species.d-nec:0" } } } }]]);
  const roll = await CypherActor.prototype.rollRecovery.call(actor, "hour");
  assert.equal(roll.total, 5); assert.equal(actor.system.stats.intellect.pool.value, 6);
});
