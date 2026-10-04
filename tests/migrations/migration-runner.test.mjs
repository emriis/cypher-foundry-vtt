// Covers world migration orchestration and compatibility guards.
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

const { migrateWorld } = await import("../../module/migration.mjs");

function applyUpdate(target, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split(".");
    let cursor = target;
    for (const part of parts.slice(0, -1)) cursor = cursor[part];
    cursor[parts.at(-1)] = value;
  }
}

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
