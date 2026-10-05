import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  activateAbilityEffect,
  expireAbilityEffectsOnRecovery
} from "../../module/applications/ability-runtime-service.mjs";

afterEach(() => {
  delete globalThis.fromUuid;
});

function createActor() {
  return {
    type: "pc",
    system: { activeAbilityEffects: [] },
    async update(changes) {
      this.system.activeAbilityEffects =
        changes["system.activeAbilityEffects"];
    }
  };
}

function createAbility(actor) {
  return {
    type: "ability",
    uuid: "Actor.pc.Item.ability",
    parent: actor,
    system: {
      effects: [{
        id: "effect",
        endConditions: [{
          kind: "recovery",
          interval: "tenMinutes",
          minimum: true
        }]
      }]
    }
  };
}

describe("Given a PC activates an Ability effect", () => {
  test("when the effect is valid, then it becomes actor-owned runtime state", async () => {
    const actor = createActor();
    const ability = createAbility(actor);

    assert.equal(
      await activateAbilityEffect(actor, ability, "effect"),
      true
    );

    assert.deepEqual(actor.system.activeAbilityEffects, [{
      itemUuid: ability.uuid,
      effectId: "effect"
    }]);
  });

  test("when the same effect is activated twice, then it is not duplicated", async () => {
    const actor = createActor();
    const ability = createAbility(actor);

    assert.equal(
      await activateAbilityEffect(actor, ability, "effect"),
      true
    );
    assert.equal(
      await activateAbilityEffect(actor, ability, "effect"),
      false
    );

    assert.equal(actor.system.activeAbilityEffects.length, 1);
  });
});

describe("Given an Ability effect that ends on a recovery", () => {
  test("when the minimum recovery is reached, then the effect expires", async () => {
    const actor = createActor();
    const ability = createAbility(actor);

    actor.system.activeAbilityEffects = [{
      itemUuid: ability.uuid,
      effectId: "effect"
    }];
    globalThis.fromUuid = async uuid =>
      uuid === ability.uuid ? ability : null;

    assert.equal(
      await expireAbilityEffectsOnRecovery(actor, "hour"),
      1
    );
    assert.deepEqual(actor.system.activeAbilityEffects, []);
  });

  test("when the recovery is shorter than the condition, then the effect remains active", async () => {
    const actor = createActor();
    const ability = createAbility(actor);

    actor.system.activeAbilityEffects = [{
      itemUuid: ability.uuid,
      effectId: "effect"
    }];
    globalThis.fromUuid = async () => ability;

    assert.equal(
      await expireAbilityEffectsOnRecovery(actor, "action"),
      0
    );
    assert.deepEqual(actor.system.activeAbilityEffects, [{
      itemUuid: ability.uuid,
      effectId: "effect"
    }]);
  });
});
