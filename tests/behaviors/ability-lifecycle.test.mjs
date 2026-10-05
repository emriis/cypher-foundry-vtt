import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  activateAbilityEffect,
  deactivateAbilityEffect,
  expireAbilityEffectsOnRecovery
} from "../../module/applications/ability-runtime-service.mjs";

describe("Given a PC activates an Ability effect", () => {
  test("when the effect exists on an owned Ability, then it becomes active", async () => {
    const actor = {
      type: "pc",
      system: { activeAbilityEffects: [] },
      async update(changes) {
        this.system.activeAbilityEffects =
          changes["system.activeAbilityEffects"];
      }
    };
    const ability = {
      type: "ability",
      parent: actor,
      uuid: "Actor.pc.Item.fury",
      system: {
        effects: [{ id: "fury", name: "Fury" }]
      }
    };

    assert.equal(await activateAbilityEffect(actor, ability, "fury"), true);
    assert.deepEqual(actor.system.activeAbilityEffects, [{
      itemUuid: ability.uuid,
      effectId: "fury"
    }]);
  });

  test("when the same effect is activated twice, then only one runtime reference exists", async () => {
    const active = [{
      itemUuid: "Actor.pc.Item.fury",
      effectId: "fury"
    }];
    const actor = {
      type: "pc",
      system: { activeAbilityEffects: active },
      async update() {
        throw new Error("Duplicate activation must not update the actor");
      }
    };
    const ability = {
      type: "ability",
      parent: actor,
      uuid: "Actor.pc.Item.fury",
      system: { effects: [{ id: "fury" }] }
    };

    assert.equal(await activateAbilityEffect(actor, ability, "fury"), false);
  });
});

describe("Given a PC has an active Ability effect", () => {
  test("when the effect is deactivated, then its runtime reference is removed", async () => {
    const actor = {
      type: "pc",
      system: {
        activeAbilityEffects: [
          { itemUuid: "Actor.pc.Item.fury", effectId: "fury" },
          { itemUuid: "Actor.pc.Item.other", effectId: "other" }
        ]
      },
      async update(changes) {
        this.system.activeAbilityEffects =
          changes["system.activeAbilityEffects"];
      }
    };

    assert.equal(
      await deactivateAbilityEffect(
        actor,
        "Actor.pc.Item.fury",
        "fury"
      ),
      true
    );
    assert.deepEqual(actor.system.activeAbilityEffects, [{
      itemUuid: "Actor.pc.Item.other",
      effectId: "other"
    }]);
  });

  test("when the recovery interval satisfies the effect end condition, then the effect expires", async () => {
    globalThis.fromUuid = async () => ({
      type: "ability",
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
    });

    const actor = {
      type: "pc",
      system: {
        activeAbilityEffects: [{
          itemUuid: "Actor.pc.Item.fury",
          effectId: "fury"
        }]
      },
      async update(changes) {
        this.system.activeAbilityEffects =
          changes["system.activeAbilityEffects"];
      }
    };

    assert.equal(
      await expireAbilityEffectsOnRecovery(actor, "hour"),
      1
    );
    assert.deepEqual(actor.system.activeAbilityEffects, []);
  });

  test("when the recovery interval does not satisfy the end condition, then the effect remains active", async () => {
    globalThis.fromUuid = async () => ({
      type: "ability",
      system: {
        effects: [{
          id: "fury",
          endConditions: [{
            kind: "recovery",
            interval: "hour"
          }]
        }]
      }
    });

    const actor = {
      type: "pc",
      system: {
        activeAbilityEffects: [{
          itemUuid: "Actor.pc.Item.fury",
          effectId: "fury"
        }]
      },
      async update() {
        throw new Error("The effect should remain active");
      }
    };

    assert.equal(
      await expireAbilityEffectsOnRecovery(actor, "tenMinutes"),
      0
    );
  });
});
