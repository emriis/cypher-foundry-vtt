import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseAbilityEffect,
  rollAbilityTable
} from "../../module/applications/ability-service.mjs";
import { toggleEquipped } from "../../module/applications/equipment-service.mjs";
import {
  toggleSecondDescriptor,
  toggleSecondFocus
} from "../../module/applications/character-service.mjs";
import { getFocusAbilityChoices } from "../../module/applications/content-service.mjs";

test("toggleEquipped unequips another armor before equipping the new one", async () => {
  const updates = [];
  const other = {
    id: "other",
    type: "armor",
    system: { equipped: true }
  };
  const item = {
    id: "new",
    type: "armor",
    system: { equipped: false },
    async update(update) {
      updates.push(update);
      this.system.equipped = update["system.equipped"];
    }
  };
  const actor = {
    items: [other, item],
    async updateEmbeddedDocuments(type, changes) {
      assert.equal(type, "Item");
      changes[0]["system.equipped"] = false;
      other.system.equipped = false;
    }
  };
  item.actor = actor;

  assert.equal(await toggleEquipped(item), true);
  assert.equal(other.system.equipped, false);
  assert.deepEqual(updates, [{ "system.equipped": true }]);
});

test("toggleSecondDescriptor clears the second Descriptor when disabled", async () => {
  const updates = [];
  const actor = {
    type: "pc",
    async update(value) {
      updates.push(value);
    }
  };

  await toggleSecondDescriptor(actor, false);
  assert.deepEqual(updates, [{
    "system.hasSecondDescriptor": false,
    "system.descriptor2": ""
  }]);
});

test("toggleSecondFocus clears the second Focus when disabled", async () => {
  const updates = [];
  const actor = {
    type: "pc",
    async update(value) {
      updates.push(value);
    }
  };

  await toggleSecondFocus(actor, false);
  assert.deepEqual(updates, [{
    "system.hasSecondFocus": false,
    "system.focus2": ""
  }]);
});

test("getFocusAbilityChoices delegates Focus graph eligibility to the application boundary", () => {
  const actor = {
    system: { tier: 2 },
    getFlag(scope, key) {
      if (scope !== "cypher") return undefined;
      if (key === "appliedFocusGraph") {
        return {
          abilities: [
            { id: "first", tier: 1, prerequisites: [] },
            { id: "second", tier: 2, prerequisites: ["first"] }
          ],
          flowchart: { edges: [] }
        };
      }
      if (key === "focusAbilityIds") return ["first"];
      return undefined;
    }
  };

  const choices = getFocusAbilityChoices(actor);
  assert.deepEqual(choices.map(ability => ability.id), ["second"]);
});

test("chooseAbilityEffect posts the selected effect", async () => {
  let message;
  globalThis.foundry = {
    applications: {
      ux: {
        TextEditor: {
          implementation: {
            enrichHTML: async value => `<p>${value}</p>`
          }
        }
      }
    }
  };
  globalThis.game = { i18n: { localize: value => value } };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async value => {
      message = value;
    }
  };

  const item = {
    type: "ability",
    name: "Frenzy",
    actor: {},
    system: {
      effects: [{
        id: "effect",
        name: "Power",
        description: "Do the thing.",
        effort: 2
      }]
    }
  };

  assert.equal(await chooseAbilityEffect(item, "effect"), true);
  assert.match(message.content, /Frenzy: Power/);
  assert.match(message.content, /Do the thing/);
});

test("rollAbilityTable rejects a missing table", async () => {
  const item = {
    type: "ability",
    system: { rollTables: [] }
  };

  assert.equal(await rollAbilityTable(item, "missing"), false);
});
