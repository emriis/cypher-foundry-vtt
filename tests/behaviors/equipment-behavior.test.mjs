import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  enforceSingleEquippedArmor,
  toggleEquipped
} from "../../module/applications/equipment-service.mjs";

describe("Given a character equips armor", () => {
  test("when another armor is already equipped, then the previous armor is unequipped", async () => {
    const first = {
      id: "first",
      type: "armor",
      system: { equipped: true }
    };
    const second = {
      id: "second",
      type: "armor",
      system: { equipped: false },
      async update(changes) {
        this.system.equipped = changes["system.equipped"];
      }
    };

    const actor = {
      items: [first, second],
      async updateEmbeddedDocuments(_type, changes) {
        for (const change of changes) {
          const item = this.items.find(candidate => candidate.id === change._id);
          item.system.equipped = change["system.equipped"];
        }
      }
    };
    second.actor = actor;

    assert.equal(await toggleEquipped(second), true);
    assert.equal(first.system.equipped, false);
    assert.equal(second.system.equipped, true);
  });

  test("when the character equips non-armor equipment, then other items remain unchanged", async () => {
    const armor = {
      id: "armor",
      type: "armor",
      system: { equipped: true }
    };
    const weapon = {
      id: "weapon",
      type: "weapon",
      system: { equipped: false },
      async update(changes) {
        this.system.equipped = changes["system.equipped"];
      }
    };
    weapon.actor = { items: [armor, weapon] };

    assert.equal(await toggleEquipped(weapon), true);
    assert.equal(armor.system.equipped, true);
    assert.equal(weapon.system.equipped, true);
  });
});

describe("Given an armor item is marked equipped", () => {
  test("when another armor is still equipped, then the invariant enforcement unequips it", async () => {
    const first = {
      id: "first",
      type: "armor",
      system: { equipped: true }
    };
    const second = {
      id: "second",
      type: "armor",
      system: { equipped: true }
    };
    const actor = {
      items: [first, second],
      async updateEmbeddedDocuments(_type, changes) {
        for (const change of changes) {
          const item = this.items.find(candidate => candidate.id === change._id);
          item.system.equipped = change["system.equipped"];
        }
      }
    };
    first.actor = actor;
    second.actor = actor;

    await enforceSingleEquippedArmor(second);

    assert.equal(first.system.equipped, false);
    assert.equal(second.system.equipped, true);
  });
});
