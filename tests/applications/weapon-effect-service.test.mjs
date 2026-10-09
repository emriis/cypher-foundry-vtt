import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWeaponTargetEffects,
  expireWeaponEffectsAfterAction,
  expireWeaponEffectsOutsideCurrentRound,
  getActiveWeaponEffects
} from "../../module/applications/weapon-effect-service.mjs";

function createNpc(effects = []) {
  return {
    type: "npc",
    flags: { cypherFoundry: { activeWeaponEffects: effects } },
    updates: [],
    async update(changes) {
      this.updates.push(changes);
      const [path, value] = Object.entries(changes)[0];
      const parts = path.split(".");
      let target = this;
      for (const part of parts.slice(0, -1)) {
        target[part] ??= {};
        target = target[part];
      }
      target[parts.at(-1)] = value;
    }
    async setFlag(scope, key, value) {
      this.updates.push({ flagScope: scope, flagKey: key, flagValue: value });
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    }
  };
}

test("weapon effects persist on NPC targets with source and duration metadata", async () => {
  globalThis.game = { combat: { id: "combat-1", round: 2 } };
  const npc = createNpc();

  const count = await applyWeaponTargetEffects(npc, [{
    effect: "hindered",
    hinderSteps: 1,
    duration: "one round"
  }], { itemId: "weapon-1", itemName: "Stunner" });

  assert.equal(count, 1);
  const [effect] = npc.flags.cypherFoundry.activeWeaponEffects;
  assert.equal(effect.effect, "hindered");
  assert.equal(effect.hinderSteps, 1);
  assert.equal(effect.duration, "one round");
  assert.equal(effect.sourceItemId, "weapon-1");
  assert.equal(effect.sourceItemName, "Stunner");
  assert.equal(effect.combatId, "combat-1");
  assert.equal(effect.combatRound, 2);
});

test("one-round effects remain active only in their application combat round", async () => {
  const npc = createNpc([{
    id: "round-effect",
    effect: "hindered",
    duration: "one round",
    combatId: "combat-1",
    combatRound: 2
  }]);
  globalThis.game = { combat: { id: "combat-1", round: 2 } };

  assert.equal(getActiveWeaponEffects(npc).length, 1);
  globalThis.game.combat.round = 3;
  assert.equal(getActiveWeaponEffects(npc).length, 0);
  assert.equal(await expireWeaponEffectsOutsideCurrentRound(npc), 1);
  assert.deepEqual(npc.flags.cypherFoundry.activeWeaponEffects, []);
});

test("next-action effects expire after the NPC action is resolved", async () => {
  const npc = createNpc([
    { id: "next-action", effect: "loseNextAction", duration: "next action" },
    { id: "persistent", effect: "hindered", duration: "one round" }
  ]);

  assert.equal(await expireWeaponEffectsAfterAction(npc), 1);
  assert.deepEqual(
    npc.flags.cypherFoundry.activeWeaponEffects.map(effect => effect.id),
    ["persistent"]
  );
});

test("weapon effects reject non-NPC targets and malformed effect collections", async () => {
  assert.equal(await applyWeaponTargetEffects({ type: "pc" }, [{ effect: "hindered" }]), 0);
  assert.equal(await applyWeaponTargetEffects(createNpc(), null), 0);
});

test("a one-round effect outside combat lasts until the target's next action", async () => {
  globalThis.game = { combat: null };
  const npc = createNpc([{
    id: "narrative-round",
    effect: "hindered",
    duration: "one round",
    combatId: null,
    combatRound: null
  }]);

  assert.equal(getActiveWeaponEffects(npc).length, 1);
  assert.equal(await expireWeaponEffectsAfterAction(npc), 1);
  assert.deepEqual(npc.flags.cypherFoundry.activeWeaponEffects, []);
});
