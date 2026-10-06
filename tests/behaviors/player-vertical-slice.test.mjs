import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { applyDescriptor, applyFocus, applyType } from "../../module/applications/content-service.mjs";
import { addWound } from "../../module/applications/damage-service.mjs";
import { purchaseAdvancementSlot } from "../../module/applications/advancement-service.mjs";
import { rollRecovery } from "../../module/applications/recovery-service.mjs";
import { rollAttack, useCypher } from "../../module/applications/item-service.mjs";

function createActor() {
  const actor = {
    id: "player-slice",
    type: "pc",
    system: {
      genre: "fantasy", tier: 1, xp: 0, effort: 1, resourcePoints: 0,
      canRallyMajor: false, freeWeaponCategories: [], freeArmorCategories: [],
      freeWeaponFamilies: [], freeWeaponSkillCategories: [], activeAbilityEffects: [],
      recoveries: { tenMinutes: false, hour: false, tenHours: false },
      stats: {
        might: { pool: { max: 8, value: 8 }, edge: 0 },
        speed: { pool: { max: 8, value: 8 }, edge: 0 },
        intellect: { pool: { max: 8, value: 8 }, edge: 0 }
      },
      wounds: {
        minor: { max: 3, current: 0 },
        moderate: { max: 3, current: 0 },
        major: { max: 3, current: 0 }
      },
      advancementSlots: Array.from({ length: 4 }, () => ({ type: null, bought: false }))
    },
    flags: {}, items: [], statuses: new Set(), updates: [],
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async toggleStatusEffect() {},
    async update(changes) {
      this.updates.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split(".");
        let target = this;
        for (const part of parts.slice(0, -1)) target = target[part] ??= {};
        target[parts.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(_type, documents) {
      const created = documents.map(document => ({
        ...document,
        id: document._id ?? `${document.name}-id`,
        uuid: `Actor.${this.id}.Item.${document._id ?? document.name}`,
        actor: this,
        async update(changes) {
          Object.assign(this, changes);
          for (const [path, value] of Object.entries(changes)) {
            const parts = path.split(".");
            let target = this;
            for (const part of parts.slice(0, -1)) target = target[part] ??= {};
            target[parts.at(-1)] = value;
          }
        }
      }));
      this.items.push(...created);
      return created;
    }
  };
  return actor;
}

function configureFoundryStubs() {
  globalThis.game = {
    i18n: {
      localize: key => key,
      format: (key, data) => `${key}:${JSON.stringify(data)}`
    }
  };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.Roll = class {
    constructor() {}
    async evaluate() { this.total = 10; return this; }
    async toMessage() { return this; }
  };
}

function ability(id, name) {
  return {
    type: "ability", id, uuid: "Compendium.test.abilities.Item." + id, name,
    system: {
      tier: 1, key: id, enabler: false, repeatable: false,
      cost: { stat: "none", amount: 0, options: [] }, action: null,
      effects: [], rollTables: [], description: name
    }
  };
}

describe("Given a player-facing Cypher character", () => {
  test("when the player builds, plays, recovers, and advances the character, the core workflow stays connected", async () => {
    configureFoundryStubs();
    const actor = createActor();

    const type = {
      type: "type", id: "type-id", name: "Warrior",
      system: { genre: "Fantasy", skillOptions: ["Athletics"], poolBonuses: { might: 2 },
        woundBonuses: { minor: 1 }, abilities: [ability("type-ability", "Battle Readiness")] }
    };
    const descriptor = {
      type: "descriptor", id: "descriptor-id", name: "Resilient",
      system: { category: "standard", genres: [], statOptions: ["might"], statAmount: 2,
        grantedSkills: ["Healing"], benefits: [], grantsSecondDescriptor: false }
    };
    const focus = {
      type: "focus", id: "focus-id", name: "Explores",
      system: { abilities: [ability("focus-one", "Focus One"), ability("focus-two", "Focus Two")], flowchart: { edges: [] } }
    };

    assert.equal(await applyType(actor, type, { stat: "might", skillName: "Athletics" }), true);
    assert.equal(await applyDescriptor(actor, descriptor, { stat: "might", skillName: "Healing" }), true);
    assert.equal(await applyFocus(actor, focus, ["focus-one", "focus-two"]), true);
    assert.equal(actor.system.type, "Warrior");
    assert.equal(actor.system.focus, "Explores");
    assert.equal(actor.system.stats.might.pool.max, 12);
    assert.equal(actor.system.wounds.minor.max, 4);
    assert.ok(actor.items.some(item => item.type === "ability"));

    const attack = {
      type: "attack", name: "Training sword", actor,
      system: { attackType: "medium", damage: 4, stat: "might", freelyUsable: true, weaponFamily: "", attackSkillCategory: "" }
    };
    actor.rollTask = async options => ({ success: true, damage: options.baseDamage });
    const attackResult = await rollAttack(attack, { difficulty: 3 });
    assert.equal(attackResult.damage, 4);

    const cypher = {
      type: "cypher", name: "Amazing effort", actor, system: { depleted: false },
      async update(changes) { this.system.depleted = changes["system.depleted"]; }
    };
    await useCypher(cypher);
    assert.equal(cypher.system.depleted, true);

    await addWound(actor, "moderate");
    assert.equal(actor.system.wounds.moderate.current, 1);
    await rollRecovery(actor, "hour");
    assert.equal(actor.system.wounds.moderate.current, 0);
    assert.equal(actor.system.recoveries.hour, true);

    actor.system.xp = 4;
    actor.system.advancementSlots[0].type = "effort";
    await purchaseAdvancementSlot(actor, 0);
    assert.equal(actor.system.xp, 0);
    assert.equal(actor.system.advancementSlots[0].bought, true);
    assert.equal(actor.system.effort, 2);
    assert.equal(actor.system.resourcePoints, 1);
  });
});
