import assert from "node:assert/strict";
import test from "node:test";

import {
  addWound,
  applyDamage,
  damageArmor,
  shieldAbsorbWound
} from "../../module/applications/damage-service.mjs";

test("addWound cascades overflow and updates token statuses", async () => {
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

  const statuses = new Set();
  const actor = {
    type: "pc",
    name: "Test",
    system: {
      wounds: {
        minor: { current: 2, max: 2 },
        moderate: { current: 1, max: 1 },
        major: { current: 0, max: 1 }
      },
      hindered: true,
      dead: false
    },
    statuses,
    async update(changes) {
      const path = Object.keys(changes)[0];
      const [, , severity] = path.split(".");
      this.system.wounds[severity].current = changes[path];
    },
    async toggleStatusEffect(status, { active }) {
      if (active) statuses.add(status);
      else statuses.delete(status);
    }
  };

  await addWound(actor, "minor");

  assert.equal(actor.system.wounds.major.current, 1);
  assert.ok(statuses.has("hindered"));
});

test("applyDamage converts direct damage and NPC damage correctly", async () => {
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

  const pc = {
    type: "pc",
    system: {
      wounds: {
        minor: { current: 0, max: 3 },
        moderate: { current: 0, max: 3 },
        major: { current: 0, max: 3 }
      },
      stats: {
        might: { pool: { value: 8, max: 8 } }
      },
      customStats: []
    },
    _resolveStat(stat) {
      return {
        data: this.system.stats[stat],
        path: `system.stats.${stat}`
      };
    },
    async update(changes) {
      this.system.stats.might.pool.value = changes["system.stats.might.pool.value"];
    },
    statuses: new Set(),
    async toggleStatusEffect() {}
  };

  await applyDamage(pc, 5, { stat: "might" });
  assert.equal(pc.system.stats.might.pool.value, 3);

  const npc = {
    type: "npc",
    system: {
      armor: 2,
      health: { value: 10, max: 10 }
    },
    async update(changes) {
      this.system.health.value = changes["system.health.value"];
    }
  };

  assert.equal(await applyDamage(npc, 5), 3);
  assert.equal(npc.system.health.value, 7);
});

test("applyNpcDamage applies partial Armor bypass exactly once", async () => {
  const npc = {
    type: "npc",
    system: {
      armor: 4,
      health: { value: 10, max: 10 }
    },
    async update(changes) {
      this.system.health.value = changes["system.health.value"];
    }
  };

  assert.equal(
    await applyDamage(npc, 6, { armorBypass: 2 }),
    4
  );
  assert.equal(npc.system.health.value, 6);
});

test("damageArmor caps accumulated Block damage at the armor base bonus", async () => {
  globalThis.game = {
    i18n: {
      localize: value => value,
      format: value => value
    }
  };
  globalThis.ui = {
    notifications: {
      warn() {},
      info() {}
    }
  };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async () => {}
  };

  let update;
  const armor = {
    system: { blockEaseDamage: 1 },
    async update(changes) {
      update = changes;
    }
  };
  const actor = {
    type: "pc",
    name: "Test",
    system: {
      armor: {
        itemId: "armor-1",
        baseBlockEase: 2
      }
    },
    items: new Map([["armor-1", armor]])
  };

  await damageArmor(actor, 5);
  assert.deepEqual(update, {
    "system.blockEaseDamage": 2
  });
});

test("shieldAbsorbWound cascades shield damage into the next severity", async () => {
  let update;
  const shield = {
    name: "Shield",
    system: {
      wounds: {
        minor: { current: 3, max: 3 },
        moderate: { current: 0, max: 2 },
        major: { current: 0, max: 1 }
      }
    },
    async update(changes) {
      update = changes;
    }
  };

  await shieldAbsorbWound({ name: "Test" }, shield, "minor");

  assert.deepEqual(update, {
    "system.wounds.moderate.current": 1
  });
});
