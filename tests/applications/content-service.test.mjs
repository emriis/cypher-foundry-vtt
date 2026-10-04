import assert from "node:assert/strict";
import test from "node:test";

const { applyType, applyFocus } = await import(
  "../../module/applications/content-service.mjs"
);

function createActor() {
  return {
    type: "pc",
    system: {
      genre: "fantasy",
      stats: {
        might: { pool: { max: 8, value: 8 }, edge: 0 },
        speed: { pool: { max: 8, value: 8 }, edge: 0 },
        intellect: { pool: { max: 8, value: 8 }, edge: 0 }
      },
      wounds: {
        minor: { max: 3 },
        moderate: { max: 3 },
        major: { max: 3 }
      }
    },
    items: [],
    flags: {},
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        const parts = path.split(".");
        let target = this;
        for (const part of parts.slice(0, -1)) {
          target = target[part] ??= {};
        }
        target[parts.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(_type, documents) {
      this.items.push(...documents);
      return documents;
    }
  };
}

test("applyType copies mechanics from resolved standalone abilities", async () => {
  globalThis.game = {
    i18n: {
      localize: value => value,
      format: value => value
    }
  };
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async () => {}
  };

  const actor = createActor();
  const ability = {
    type: "ability",
    id: "ability-id",
    name: "Frenzy",
    system: {
      tier: 1,
      key: "frenzy",
      enabler: false,
      repeatable: false,
      cost: { stat: "might", amount: 1, options: [] },
      action: null,
      effects: [],
      rollTables: [],
      description: "Enter a frenzy."
    }
  };
  const type = {
    type: "type",
    id: "type-id",
    name: "Barbarian",
    system: {
      genre: "Fantasy",
      poolBonuses: { might: 0, speed: 0, intellect: 0 },
      edgeChoice: 0,
      woundBonuses: { minor: 0, moderate: 0, major: 0 },
      freeWeapons: false,
      freeArmor: false,
      freeWeaponCategories: [],
      freeArmorCategories: [],
      freeWeaponFamilies: [],
      skillOptions: [],
      abilities: [ability]
    }
  };

  assert.equal(await applyType(actor, type), true);
  assert.equal(actor.items.length, 1);
  assert.equal(actor.items[0].name, "Frenzy");
  assert.equal(actor.items[0].system.source, "Barbarian");
  assert.equal(actor.items[0].system.cost.amount, 1);
});

test("applyType rejects a wrong-type ability reference", async () => {
  globalThis.game = {
    i18n: { localize: value => value }
  };
  globalThis.ui = { notifications: { warn() {} } };

  const actor = createActor();
  const type = {
    type: "type",
    id: "type-id",
    name: "Invalid Type",
    system: {
      poolBonuses: { might: 0, speed: 0, intellect: 0 },
      woundBonuses: { minor: 0, moderate: 0, major: 0 },
      abilities: [{
        type: "descriptor",
        id: "wrong-type"
      }]
    }
  };

  assert.equal(await applyType(actor, type), false);
  assert.equal(actor.items.length, 0);
});

test("applyFocus rejects a missing ability reference before changing the actor", async () => {
  globalThis.game = {
    i18n: { localize: value => value }
  };
  globalThis.ui = { notifications: { warn() {} } };

  globalThis.fromUuid = async () => null;

  const actor = createActor();
  const focus = {
    type: "focus",
    id: "focus-id",
    name: "Missing Focus",
    system: {
      abilities: ["Compendium.test.abilities.Item.missing"],
      flowchart: { edges: [] }
    }
  };

  assert.equal(await applyFocus(actor, focus, ["missing", "other"]), false);
  assert.equal(actor.system.focus, undefined);
  assert.equal(actor.items.length, 0);
});

test("selectFocusAbility does not mutate actor state when its source cannot be resolved", async () => {
  globalThis.game = {
    i18n: { localize: value => value }
  };
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.fromUuid = async () => null;

  const actor = {
    type: "pc",
    system: {
      tier: 2,
      focus: "Missing Focus"
    },
    flags: {
      cypher: {
        focusAbilityIds: ["first"],
        appliedFocusGraph: {
          abilities: [{
            id: "second",
            uuid: "Compendium.test.abilities.Item.second",
            tier: 2,
            prerequisites: ["first"],
            repeatable: false
          }]
        }
      }
    },
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async update() {
      throw new Error("Actor must not be updated before resolving the ability");
    }
  };

  const { selectFocusAbility } = await import(
    "../../module/applications/content-service.mjs"
  );

  assert.equal(await selectFocusAbility(actor, "second"), false);
});
