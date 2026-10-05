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
    for (const part of parts.slice(0, -1)) cursor = cursor[part];
    cursor[parts.at(-1)] = value;
  }
}

function createPc() {
  const actor = {
    type: "pc",
    name: "Test PC",
    system: {
      tier: 2,
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
