import assert from "node:assert/strict";
import test from "node:test";

import {
  addCustomField,
  addCustomStat,
  spendXP
} from "../../module/applications/character-service.mjs";

test("spendXP updates the actor only when enough XP is available", async () => {
  globalThis.game = {
    i18n: {
      format: value => value
    }
  };
  globalThis.ui = {
    notifications: {
      error() {}
    }
  };

  const actor = {
    type: "pc",
    system: { xp: 5 },
    async update(changes) {
      this.lastUpdate = changes;
      this.system.xp = changes["system.xp"];
    }
  };

  assert.equal(await spendXP(actor, 3, "test"), true);
  assert.equal(actor.system.xp, 2);

  assert.equal(await spendXP(actor, 3, "test"), false);
  assert.equal(actor.system.xp, 2);
});

test("custom character operations preserve the document data shape", async () => {
  globalThis.foundry = {
    utils: {
      randomID: length => length === 6 ? "abc123" : "field123"
    }
  };
  globalThis.ui = {
    notifications: {
      warn() {}
    }
  };
  globalThis.game = {
    i18n: {
      localize: value => value
    }
  };

  const actor = {
    type: "pc",
    system: {
      customStats: [],
      customFields: []
    },
    async update(changes) {
      Object.assign(this.system, {
        customStats: changes["system.customStats"] ?? this.system.customStats,
        customFields: changes["system.customFields"] ?? this.system.customFields
      });
    }
  };

  await addCustomStat(actor, " Favour ");
  await addCustomField(actor, " Reputation ", "text");

  assert.deepEqual(actor.system.customStats, [{
    id: "favour",
    label: "Favour",
    pool: { max: 8, value: 8 },
    edge: 0
  }]);
  assert.deepEqual(actor.system.customFields, [{
    id: "field-field123",
    label: "Reputation",
    fieldType: "text",
    valueText: "",
    valueNumber: 0,
    valueBoolean: false
  }]);
});
