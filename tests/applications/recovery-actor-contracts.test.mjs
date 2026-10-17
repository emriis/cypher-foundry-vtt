/** Direct recovery service contracts relocated from the Actor compatibility suite. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { rollRecovery, rallyWound } from "../../module/applications/recovery-service.mjs";
import { applyDocumentUpdate as applyUpdate } from "../helpers/document-updates.mjs";

beforeEach(() => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  delete globalThis.fromUuid;
});
test("rollRecovery restores Pool with Tier and recovery bonus and clears the correct wounds", async () => {
  let rollMessage;
  globalThis.Roll = class {
    constructor(formula, data) {
      this.formula = formula;
      this.data = data;
    }
    async evaluate() {
      this.total = 9;
      return this;
    }
    async toMessage(data) {
      rollMessage = data;
      return this;
    }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.game = { i18n: { localize: value => value } };

  const actor = {
    type: "pc",
    system: {
      tier: 2,
      recoveryBonus: 1,
      recoveries: { action: false, tenMinutes: false, hour: false, tenHours: false },
      wounds: {
        minor: { current: 2, max: 3 },
        moderate: { current: 1, max: 2 },
        major: { current: 1, max: 1 }
      }
    },
    update: async changes => {
      applyUpdate(actor, changes);
    }
  };

  const roll = await rollRecovery(actor, "hour");

  assert.equal(roll.total, 9);
  assert.equal(roll.formula, "1d6 + @tier + @bonus");
  assert.deepEqual(roll.data, { tier: 2, bonus: 1 });
  assert.equal(actor.system.wounds.moderate.current, 0);
  assert.equal(actor.system.wounds.minor.current, 2);
  assert.equal(actor.system.recoveries.hour, true);
  assert.match(rollMessage.flavor, /CYPHER\.Recovery\.hour/);
});

test("rallyWound spends the correct Might cost and removes one wound", async () => {
  let changes;
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };

  const actor = {
    type: "pc",
    name: "Test PC",
    system: {
      canRallyMajor: false,
      stats: { might: { pool: { value: 6 } } },
      wounds: { minor: { current: 1 }, moderate: { current: 1 }, major: { current: 0 } }
    },
    update: async update => {
      changes = update;
      applyUpdate(actor, update);
    }
  };

  await rallyWound(actor, "moderate");

  assert.deepEqual(changes, {
    "system.stats.might.pool.value": 1,
    "system.wounds.moderate.current": 0
  });
  assert.equal(actor.system.stats.might.pool.value, 1);
  assert.equal(actor.system.wounds.moderate.current, 0);
});

test("rallyWound rejects a major wound outside the Superhero genre", async () => {
  let updateCalled = false;
  globalThis.game = { i18n: { localize: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };

  const actor = {
    type: "pc",
    system: {
      canRallyMajor: false,
      stats: { might: { pool: { value: 20 } } },
      wounds: { minor: { current: 0 }, moderate: { current: 0 }, major: { current: 1 } }
    },
    update: async () => { updateCalled = true; }
  };

  await rallyWound(actor, "major");

  assert.equal(updateCalled, false);
});
