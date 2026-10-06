import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  applyDescriptor,
  applyFocus,
  applyType,
  selectFocusAbility
} from "../../module/applications/content-service.mjs";

function createActor(overrides = {}) {
  const actor = {
    type: "pc",
    system: {
      genre: "fantasy",
      tier: 1,
      stats: {
        might: { pool: { max: 8, value: 8 }, edge: 0 },
        speed: { pool: { max: 8, value: 8 }, edge: 0 },
        intellect: { pool: { max: 8, value: 8 }, edge: 0 }
      },
      wounds: {
        minor: { max: 3 },
        moderate: { max: 3 },
        major: { max: 3 }
      },
      freeWeaponCategories: [],
      freeArmorCategories: [],
      freeWeaponFamilies: [],
      freeWeaponSkillCategories: []
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

  Object.assign(actor, overrides);
  return actor;
}

function ability(id, name, tier, extra = {}) {
  return {
    type: "ability",
    id,
    uuid: "Compendium.test.abilities.Item." + id,
    name,
    system: {
      tier,
      key: id,
      enabler: false,
      repeatable: false,
      cost: { stat: "none", amount: 0, options: [] },
      action: null,
      effects: [],
      rollTables: [],
      description: name,
      prerequisites: [],
      ...extra
    }
  };
}

function configureFoundryStubs() {
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
}

describe("Given a new PC builds a character from CRD content", () => {
  test(
    "when a Type grants an Ability and a skill choice, then both become " +
      "actor-owned content",
    async () => {
      configureFoundryStubs();
      const actor = createActor();
      const type = {
        type: "type",
        id: "type-id",
        name: "Warrior",
        system: {
          genre: "Fantasy",
          skillOptions: ["Athletics"],
          poolBonuses: { might: 2 },
          woundBonuses: { minor: 1 },
          abilities: [ability("battle-readiness", "Battle Readiness", 1)]
        }
      };

      assert.equal(await applyType(actor, type), true);
      assert.equal(actor.system.type, "Warrior");
      assert.equal(actor.system.stats.might.pool.max, 10);
      assert.equal(actor.system.wounds.minor.max, 4);
      assert.deepEqual(
        actor.items.map(item => item.name),
        ["Athletics", "Battle Readiness"]
      );
    }
  );

  test(
    "when a Focus has exactly two eligible Tier 1 choices, then both choices " +
      "are persisted with the Focus graph",
    async () => {
      const actor = createActor();
      const first = ability("first", "First Ability", 1);
      const second = ability("second", "Second Ability", 1);
      const later = ability("later", "Later Ability", 2, {
        prerequisites: ["first"]
      });
      const focus = {
        type: "focus",
        id: "focus-id",
        name: "Studies the Strange",
        system: {
          abilities: [first, second, later],
          flowchart: {
            edges: [{ from: "first", to: "later" }]
          }
        }
      };

      assert.equal(
        await applyFocus(actor, focus, ["first", "second"]),
        true
      );
      assert.equal(actor.system.focus, "Studies the Strange");
      assert.deepEqual(
        actor.getFlag("cypher", "focusAbilityIds").sort(),
        ["first", "second"]
      );
      assert.equal(
        actor.getFlag("cypher", "appliedFocusGraph").abilities.length,
        3
      );
      assert.deepEqual(
        actor.items.map(item => item.system.focusAbilityId).sort(),
        ["first", "second"]
      );
    }
  );

  test(
    "when the PC reaches Tier 2, then an eligible Focus Ability is selected " +
      "and becomes actor-owned",
    async () => {
      const actor = createActor({
        system: {
          ...createActor().system,
          tier: 2,
          focus: "Studies the Strange"
        },
        flags: {
          cypher: {
            focusAbilityIds: ["first", "second"],
            appliedFocusGraph: {
              abilities: [
                ability("first", "First Ability", 1),
                ability("second", "Second Ability", 1),
                ability("later", "Later Ability", 2, {
                  prerequisites: ["first"]
                })
              ].map(item => ({
                id: item.id,
                uuid: item.uuid,
                name: item.name,
                ...item.system
              }))
            }
          }
        }
      });

      globalThis.fromUuid = async uuid =>
        uuid.endsWith(".later")
          ? ability("later", "Later Ability", 2, {
              prerequisites: ["first"]
            })
          : null;

      assert.equal(await selectFocusAbility(actor, "later"), true);
      assert.deepEqual(
        actor.getFlag("cypher", "focusAbilityIds"),
        ["first", "second", "later"]
      );
      assert.equal(actor.items.at(-1).system.focusAbilityId, "later");
    }
  );

  test(
    "when a species Descriptor matches the PC genre, then its stat, skill, " +
      "and benefit are applied",
    async () => {
      configureFoundryStubs();
      const actor = createActor();
      const descriptor = {
        type: "descriptor",
        id: "species-id",
        name: "Adapted",
        system: {
          category: "species",
          genres: ["fantasy"],
          statOptions: ["speed"],
          statAmount: 2,
          grantedSkills: ["Survival"],
          benefits: [{
            name: "Night Sight",
            description: "See in darkness."
          }],
          grantsSecondDescriptor: true
        }
      };

      assert.equal(await applyDescriptor(actor, descriptor), true);
      assert.equal(actor.system.species, "Adapted");
      assert.equal(actor.system.hasSecondDescriptor, true);
      assert.equal(actor.system.stats.speed.pool.max, 10);
      assert.deepEqual(
        actor.items.map(item => item.name),
        ["Survival", "Night Sight"]
      );
      assert.equal(actor.items.at(-1).system.source, "Adapted");
    }
  );
});
