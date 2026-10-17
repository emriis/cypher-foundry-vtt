/** Direct damage service contracts relocated from the Actor compatibility suite. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { shieldAbsorbWound, damageArmor, repairArmor, applyDamage, addWound, syncWoundStatusEffects } from "../../module/applications/damage-service.mjs";
import { applyDocumentUpdate as applyUpdate } from "../helpers/document-updates.mjs";

beforeEach(() => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  delete globalThis.fromUuid;
});
test("shieldAbsorbWound cascades a full minor shield wound into moderate", async () => {
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
    update: async changes => { update = changes; }
  };
  const actor = {
    type: "pc",
    name: "Test PC"
  };

  await shieldAbsorbWound(actor, shield, "minor");

  assert.deepEqual(update, { "system.wounds.moderate.current": 1 });
});

test("damageArmor caps armor damage at its base Block bonus and repairArmor clears it", async () => {
  let armorUpdate;
  const armor = {
    system: { blockEaseDamage: 1 },
    update: async changes => { armorUpdate = changes; }
  };
  const actor = {
    type: "pc",
    name: "Test PC",
    system: {
      armor: { itemId: "armor-1", baseBlockEase: 2 }
    },
    items: new Map([["armor-1", armor]])
  };

  await damageArmor(actor, 5);
  assert.deepEqual(armorUpdate, { "system.blockEaseDamage": 2 });

  await repairArmor(actor);
  assert.deepEqual(armorUpdate, { "system.blockEaseDamage": 0 });
});

test("NPC damage uses armor before reducing health and can ignore armor", async () => {
  const updates = [];
  const actor = {
    type: "npc",
    system: { armor: 2, health: { value: 10, max: 10 } },
    update: async changes => {
      updates.push(changes);
      actor.system.health.value = changes["system.health.value"];
    }
  };

  assert.equal(await applyDamage(actor, 5), 3);
  assert.equal(actor.system.health.value, 7);

  assert.equal(
    await applyDamage(actor, 5, { ignoreArmor: true }),
    5
  );
  assert.equal(actor.system.health.value, 2);
  assert.deepEqual(updates, [
    { "system.health.value": 7 },
    { "system.health.value": 2 }
  ]);
});

test("adding wounds cascades across full tracks and synchronizes Hindered and Dead states", async () => {
  globalThis.game = { i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };

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
    update: async changes => applyUpdate(actor, changes),
    toggleStatusEffect: async (status, { active }) => {
      if (active) statuses.add(status);
      else statuses.delete(status);
    },
  };

  await addWound(actor, "minor");
  assert.equal(actor.system.wounds.major.current, 1);

  actor.system.hindered = true;
  actor.system.dead = true;
  await syncWoundStatusEffects(actor);
  assert.equal(statuses.has("hindered"), true);
  assert.equal(statuses.has("dead"), true);
});
