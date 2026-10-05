import assert from "node:assert/strict";
import test from "node:test";

import {
  activateAbilityEffect,
  deactivateAbilityEffect,
  expireAbilityEffectsOnRecovery
} from "../../module/applications/ability-runtime-service.mjs";

test("activating an Ability effect stores actor-owned runtime state", async () => {
  const actor = {
    type: "pc",
    system: { activeAbilityEffects: [] },
    updates: [],
    async update(changes) {
      this.updates.push(changes);
      this.system.activeAbilityEffects =
        changes["system.activeAbilityEffects"];
    }
  };

  const item = {
    type: "ability",
    uuid: "Actor.pc.Item.ability",
    parent: actor,
    system: {
      effects: [{
        id: "fury",
        name: "Fury",
        endConditions: [{
          kind: "recovery",
          interval: "tenMinutes",
          minimum: true
        }]
      }]
    }
  };

  assert.equal(await activateAbilityEffect(actor, item, "fury"), true);
  assert.deepEqual(actor.system.activeAbilityEffects, [{
    itemUuid: "Actor.pc.Item.ability",
    effectId: "fury"
  }]);
  assert.equal(await activateAbilityEffect(actor, item, "fury"), false);
});


test("activation rejects an Ability Item not owned by the actor", async () => {
  const actor = {
    type: "pc",
    system: { activeAbilityEffects: [] },
    async update() {
      assert.fail("Unowned Ability must not update the actor");
    }
  };

  const item = {
    type: "ability",
    uuid: "Item.unowned",
    parent: null,
    system: {
      effects: [{ id: "effect", endConditions: [] }]
    }
  };

  assert.equal(await activateAbilityEffect(actor, item, "effect"), false);
});

test("deactivation removes only the requested runtime effect", async () => {
  const actor = {
    type: "pc",
    system: {
      activeAbilityEffects: [
        { itemUuid: "ability.one", effectId: "first" },
        { itemUuid: "ability.two", effectId: "second" }
      ]
    },
    async update(changes) {
      this.system.activeAbilityEffects =
        changes["system.activeAbilityEffects"];
    }
  };

  assert.equal(
    await deactivateAbilityEffect(actor, "ability.one", "first"),
    true
  );
  assert.deepEqual(actor.system.activeAbilityEffects, [{
    itemUuid: "ability.two",
    effectId: "second"
  }]);
});

test("a ten-minute-or-longer condition expires on an hour recovery", async () => {
  const ability = {
    type: "ability",
    uuid: "Actor.pc.Item.fury",
    system: {
      effects: [{
        id: "fury",
        endConditions: [{
          kind: "recovery",
          interval: "tenMinutes",
          minimum: true
        }]
      }]
    }
  };

  globalThis.fromUuid = async uuid =>
    uuid === ability.uuid ? ability : null;

  const actor = {
    type: "pc",
    system: {
      activeAbilityEffects: [
        { itemUuid: ability.uuid, effectId: "fury" }
      ]
    },
    updates: [],
    async update(changes) {
      this.updates.push(changes);
      this.system.activeAbilityEffects =
        changes["system.activeAbilityEffects"];
    }
  };

  assert.equal(await expireAbilityEffectsOnRecovery(actor, "hour"), 1);
  assert.deepEqual(actor.system.activeAbilityEffects, []);
});

test("a shorter recovery does not expire a minimum condition", async () => {
  const ability = {
    type: "ability",
    uuid: "Actor.pc.Item.fury",
    system: {
      effects: [{
        id: "fury",
        endConditions: [{
          kind: "recovery",
          interval: "tenMinutes",
          minimum: true
        }]
      }]
    }
  };

  globalThis.fromUuid = async () => ability;

  const actor = {
    type: "pc",
    system: {
      activeAbilityEffects: [
        { itemUuid: ability.uuid, effectId: "fury" }
      ]
    },
    async update() {
      assert.fail("No update should be needed");
    }
  };

  assert.equal(
    await expireAbilityEffectsOnRecovery(actor, "action"),
    0
  );
});


test("missing Ability references remain in runtime state during recovery", async () => {
  globalThis.fromUuid = async () => null;

  const actor = {
    type: "pc",
    system: {
      activeAbilityEffects: [
        { itemUuid: "Actor.pc.Item.missing", effectId: "effect" }
      ]
    },
    async update() {
      assert.fail("A missing source reference must not be removed implicitly");
    }
  };

  assert.equal(
    await expireAbilityEffectsOnRecovery(actor, "hour"),
    0
  );
  assert.deepEqual(actor.system.activeAbilityEffects, [{
    itemUuid: "Actor.pc.Item.missing",
    effectId: "effect"
  }]);
});

test("effects without a recovery end condition remain active", async () => {
  const ability = {
    type: "ability",
    uuid: "Actor.pc.Item.persistent",
    system: {
      effects: [{
        id: "persistent",
        endConditions: []
      }]
    }
  };

  globalThis.fromUuid = async () => ability;

  const actor = {
    type: "pc",
    system: {
      activeAbilityEffects: [
        { itemUuid: ability.uuid, effectId: "persistent" }
      ]
    },
    async update() {
      assert.fail("No update should be needed");
    }
  };

  assert.equal(
    await expireAbilityEffectsOnRecovery(actor, "hour"),
    0
  );
});
