import assert from "node:assert/strict";
import test from "node:test";

// The document class extends Foundry's global Actor, but these rule helpers do
// not need a Foundry runtime.
globalThis.Actor = class Actor {};

const { default: CypherActor } = await import("../module/documents/actor.mjs");

test("computeEffortCost charges the first level, additional levels, and Edge once", () => {
  assert.equal(CypherActor.computeEffortCost(1), 3);
  assert.equal(CypherActor.computeEffortCost(3), 7);
  assert.equal(CypherActor.computeEffortCost(3, 2), 5);
  assert.equal(CypherActor.computeEffortCost(1, 5), 0);
});

test("computeEffortCost does not charge for zero or negative Effort", () => {
  assert.equal(CypherActor.computeEffortCost(0), 0);
  assert.equal(CypherActor.computeEffortCost(-1), 0);
});

test("reduceWoundSeverity lowers wounds by one tier", () => {
  const reduce = CypherActor.prototype._reduceWoundSeverity;

  assert.equal(reduce.call({}, "major"), "moderate");
  assert.equal(reduce.call({}, "moderate"), "minor");
  assert.equal(reduce.call({}, "minor"), null);
  assert.equal(reduce.call({}, "unknown"), null);
});

test("convertDamageToWound honors documented damage thresholds", () => {
  const convert = CypherActor.prototype._convertDamageToWound;

  assert.equal(convert.call({}, 1), "minor");
  assert.equal(convert.call({}, 4), "minor");
  assert.equal(convert.call({}, 5), "moderate");
  assert.equal(convert.call({}, 8), "moderate");
  assert.equal(convert.call({}, 9), "major");
});

test("applyType applies pool, Edge, wound, and equipment benefits once", async () => {
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.game = {
    i18n: {
      localize: value => value,
      format: (value, data) => `${value}:${data.name ?? data.level ?? ""}`
    }
  };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async () => {}
  };

  const actor = {
    type: "pc",
    id: "actor-id",
    system: {
      genre: "none",
      stats: {
        might: { pool: { max: 8, value: 5 }, edge: 0 },
        speed: { pool: { max: 8, value: 8 }, edge: 1 },
        intellect: { pool: { max: 8, value: 8 }, edge: 0 }
      },
      wounds: {
        minor: { max: 3, current: 0 },
        moderate: { max: 3, current: 0 },
        major: { max: 3, current: 0 }
      }
    },
    items: [],
    flags: {},
    async createEmbeddedDocuments(collection, documents) {
      assert.equal(collection, "Item");
      this.items.push(...documents.map(document => ({ ...document, id: `${document.name}-id` })));
      return documents;
    },
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        if (path === "flags.cypher.appliedTypeId") {
          this.flags.cypher ??= {};
          this.flags.cypher.appliedTypeId = value;
          continue;
        }
        const segments = path.split(".");
        let target = this;
        for (const segment of segments.slice(0, -1)) target = target[segment];
        target[segments.at(-1)] = value;
      }
    }
  };
  const typeItem = {
    id: "barbarian-id",
    name: "Barbarian",
    type: "type",
    system: {
      genre: "Fantasy",
      poolBonuses: { might: 3, speed: 1, intellect: 0 },
      edgeChoice: 1,
      woundBonuses: { minor: 3, moderate: 1, major: 0 },
      freeWeapons: true,
      freeArmor: true,
      skillOptions: [],
      abilities: [{
        name: "Frenzy",
        tier: 1,
        enabler: false,
        cost: { stat: "intellect", amount: 1 },
        description: "Enter a state of frenzy."
      }]
    }
  };

  assert.equal(await CypherActor.prototype.applyType.call(actor, typeItem, { stat: "speed" }), true);
  assert.equal(actor.system.type, "Barbarian");
  assert.equal(actor.system.genre, "fantasy");
  assert.deepEqual(actor.system.stats.might.pool, { max: 11, value: 8 });
  assert.deepEqual(actor.system.stats.speed.pool, { max: 9, value: 9 });
  assert.equal(actor.system.stats.speed.edge, 2);
  assert.equal(actor.system.wounds.minor.max, 6);
  assert.equal(actor.system.wounds.moderate.max, 4);
  assert.equal(actor.system.canFreelyUseAllWeapons, true);
  assert.equal(actor.system.canFreelyUseAllArmor, true);
  assert.deepEqual(actor.items[0].system, {
    source: "Barbarian",
    tier: 1,
    enabler: false,
    cost: { stat: "intellect", amount: 1 },
    action: "none",
    description: "Enter a state of frenzy."
  });

  assert.equal(await CypherActor.prototype.applyType.call(actor, typeItem), false);
});
