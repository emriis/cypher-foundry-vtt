// Covers recovery and migration flows that update persistent actor data.
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

const { default: CypherActor } = await import("../module/documents/actor.mjs");
const { migrateWorld } = await import("../module/migration.mjs");
const { buildLegacyFreeUseUpdates } = await import(
  "../module/migrations/actor-schema-migrations.mjs"
);
const { migrateWorldTypeAndFocusAbilities, inferLegacyAbilityAction, slugLegacyAbilityName } = await import(
  "../module/migrations/legacy-content-migrations.mjs"
);

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


test("buildLegacyFreeUseUpdates is deterministic and does not mutate actor data", () => {
  const actor = {
    type: "pc",
    system: {
      genre: "fantasy",
      type: "Barbare",
      canFreelyUseAllWeapons: true,
      canFreelyUseAllArmor: true,
      advancementSlots: []
    }
  };
  const before = structuredClone(actor);
  const updates = buildLegacyFreeUseUpdates(actor);

  assert.deepEqual(updates["system.freeWeaponCategories"], [
    "light",
    "medium",
    "heavy"
  ]);
  assert.deepEqual(updates["system.freeArmorCategories"], ["light", "medium"]);
  assert.deepEqual(actor, before);
});

test("buildLegacyFreeUseUpdates preserves explicit all-category advancements", () => {
  const actor = {
    type: "pc",
    system: {
      genre: "fantasy",
      type: "Mage",
      canFreelyUseAllWeapons: true,
      canFreelyUseAllArmor: true,
      advancementSlots: [
        { type: "other", otherType: "armor", bought: true }
      ]
    }
  };
  const updates = buildLegacyFreeUseUpdates(actor);

  assert.deepEqual(updates["system.freeArmorCategories"], [
    "light",
    "medium",
    "heavy"
  ]);
});

test("legacy ability helpers normalize action metadata and generated keys", () => {
  assert.equal(
    inferLegacyAbilityAction({
      description: "Do something. Action."
    }),
    "action"
  );
  assert.equal(
    inferLegacyAbilityAction({
      enabler: true,
      description: "Do something. Action."
    }),
    null
  );
  assert.equal(slugLegacyAbilityName("Éclaireur: À l'épée"), "eclaireur-a-l-epee");
});


test("migrateWorldTypeAndFocusAbilities converts embedded Focus abilities to references", async () => {
  const created = [];
  const focus = {
    type: "focus",
    uuid: "Item.focus",
    _source: {
      system: {
        abilities: [
          {
            id: "ability-one",
            name: "First Ability",
            tier: 1,
            enabler: true
          },
          {
            id: "ability-two",
            name: "Second Ability",
            tier: 2,
            prerequisites: ["ability-one"],
            description: "Do something. Action."
          }
        ]
      }
    },
    async update(changes) {
      this.lastUpdate = changes;
      this._source.system.abilities = changes["system.abilities"];
      this._source.system.flowchart = changes["system.flowchart"];
    }
  };

  globalThis.Item = {
    create: async data => {
      const document = {
        ...data,
        id: `created-${created.length + 1}`,
        uuid: `Item.created-${created.length + 1}`
      };
      created.push(document);
      return document;
    }
  };
  globalThis.game = { items: [focus] };

  await migrateWorldTypeAndFocusAbilities();

  assert.equal(created.length, 2);
  assert.deepEqual(focus.lastUpdate["system.abilities"], [
    "Item.created-1",
    "Item.created-2"
  ]);
  assert.deepEqual(focus.lastUpdate["system.flowchart"], {
    edges: [{ from: "created-1", to: "created-2" }]
  });
  assert.equal(created[1].system.action, "action");
});

test("migrateWorld skips non-GMs and does not advance the schema version", async () => {
  let settingWrites = 0;
  globalThis.game = {
    user: { isGM: false },
    i18n: {
      localize: key => key,
      format: (key, data) => `${key}:${JSON.stringify(data)}`
    },
    settings: {
      get: () => "0.1.0",
      set: async () => { settingWrites += 1; }
    },
    system: { flags: { needsMigrationVersion: "0.2.0" } },
    actors: [],
    packs: []
  };
  globalThis.foundry = {
    utils: { isNewerVersion: (a, b) => a.localeCompare(b, undefined, { numeric: true }) > 0 }
  };

  await migrateWorld();
  assert.equal(settingWrites, 0);
});

test("migrateWorld migrates world and unlocked Actor-pack actors before recording the version", async () => {
  const worldActor = { name: "World actor", setFlag: async (...args) => { worldActor.flag = args; } };
  const packActor = { documentName: "Actor", name: "Pack actor", setFlag: async (...args) => { packActor.flag = args; } };
  let recordedVersion;
  globalThis.game = {
    user: { isGM: true },
    i18n: {
      localize: key => key,
      format: (key, data) => `${key}:${JSON.stringify(data)}`
    },
    settings: {
      get: () => "0.1.0",
      set: async (_namespace, _key, value) => { recordedVersion = value; }
    },
    system: { flags: { needsMigrationVersion: "0.2.0", compatibleMigrationVersion: "0.1.0" } },
    actors: [worldActor],
    packs: [
      { locked: false, documentName: "Actor", collection: "actors", getDocuments: async () => [packActor] },
      { locked: true, documentName: "Actor", getDocuments: async () => { throw new Error("Locked packs must not be read"); } },
      { locked: false, documentName: "Item", getDocuments: async () => [{ documentName: "Item", name: "Pack item" }] }
    ]
  };
  globalThis.foundry = {
    utils: { isNewerVersion: (a, b) => a.localeCompare(b, undefined, { numeric: true }) > 0 }
  };

  await migrateWorld();

  assert.deepEqual(worldActor.flag, ["cypher", "schemaVersion", "0.2.0"]);
  assert.deepEqual(packActor.flag, ["cypher", "schemaVersion", "0.2.0"]);
  assert.equal(recordedVersion, "0.2.0");
});

test("migrateWorld blocks incompatible schema versions without touching documents", async () => {
  let settingWrites = 0;
  let actorReads = 0;
  globalThis.game = {
    user: { isGM: true },
    i18n: {
      localize: key => key,
      format: (key, data) => `${key}:${JSON.stringify(data)}`
    },
    settings: {
      get: () => "0.1.0",
      set: async () => { settingWrites += 1; }
    },
    system: { flags: { needsMigrationVersion: "0.2.0", compatibleMigrationVersion: "0.2.0" } },
    actors: [{ setFlag: async () => { actorReads += 1; } }],
    packs: []
  };
  globalThis.foundry = {
    utils: { isNewerVersion: (a, b) => a.localeCompare(b, undefined, { numeric: true }) > 0 }
  };

  await migrateWorld();

  assert.equal(actorReads, 0);
  assert.equal(settingWrites, 0);
});

test("migrateWorld replaces legacy Type-wide armor grants with exact categories", async () => {
  const makeActor = (name, type, advancementSlots = []) => ({
    name,
    type: "pc",
    system: {
      genre: "fantasy",
      type,
      canFreelyUseAllWeapons: true,
      canFreelyUseAllArmor: true,
      advancementSlots
    },
    flags: { cypher: { appliedTypeId: `${type}-type-id` } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(changes) {
      this.lastUpdate = changes;
      applyUpdate(this, changes);
    },
    async setFlag(scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }
  });
  const barbarian = makeActor("Barbare", "Barbare");
  const mageWithAdvancement = makeActor("Mage", "Mage", [
    { type: "other", otherType: "armor", bought: true }
  ]);

  globalThis.game = {
    user: { isGM: true },
    i18n: { localize: key => key, format: key => key },
    settings: { get: () => "0.1.0", set: async () => {} },
    system: { flags: { needsMigrationVersion: "0.1.7", compatibleMigrationVersion: "0.1.0" } },
    actors: [barbarian, mageWithAdvancement],
    packs: []
  };
  globalThis.foundry = {
    utils: { isNewerVersion: (a, b) => a.localeCompare(b, undefined, { numeric: true }) > 0 }
  };

  await migrateWorld();

  assert.deepEqual(barbarian.system.freeWeaponCategories, ["light", "medium", "heavy"]);
  assert.deepEqual(barbarian.system.freeArmorCategories, ["light", "medium"]);
  assert.equal(barbarian.system.canFreelyUseAllWeapons, false);
  assert.equal(barbarian.system.canFreelyUseAllArmor, false);
  assert.equal(barbarian.flags.cypher.freeUseMigrationBackup.canFreelyUseAllArmor, true);
  assert.deepEqual(mageWithAdvancement.system.freeArmorCategories, ["light", "medium", "heavy"]);
});
