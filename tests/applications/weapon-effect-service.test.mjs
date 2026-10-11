import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWeaponTargetEffects,
  expireWeaponEffectsAfterAction,
  expireWeaponEffectsOutsideCurrentRound,
  extendWeaponEffect,
  getActiveWeaponEffects
} from "../../module/applications/weapon-effect-service.mjs";

function createNpc(effects = []) {
  return {
    type: "npc",
    flags: { cypher: { activeWeaponEffects: effects } },
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
    },
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
  const [effect] = npc.flags.cypher.activeWeaponEffects;
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
  assert.deepEqual(npc.flags.cypher.activeWeaponEffects, []);
});

test("next-action effects expire after the NPC action is resolved", async () => {
  globalThis.game = { combat: { id: "combat-1", round: 2 } };
  const npc = createNpc([
    { id: "next-action", effect: "loseNextAction", duration: "next action" },
    { id: "persistent", effect: "hindered", duration: "one round", combatId: "combat-1", combatRound: 2 }
  ]);

  assert.equal(await expireWeaponEffectsAfterAction(npc), 1);
  assert.deepEqual(
    npc.flags.cypher.activeWeaponEffects.map(effect => effect.id),
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
  assert.deepEqual(npc.flags.cypher.activeWeaponEffects, []);
});

// CRD Science Fiction Equipment, Stunstick: "a round or two".
// User decision: one round by default; only an explicit GM decision extends it.
test("Given a Stunstick hit, when the next combat round begins, then default hindrance expires", async () => {
  globalThis.game = { combat: { id: "combat-stun", round: 4 } };
  const npc = createNpc();
  await applyWeaponTargetEffects(npc, [{ effect: "hindered", hinderSteps: 2, duration: "a round or two" }]);
  assert.equal(getActiveWeaponEffects(npc).length, 1);
  globalThis.game.combat.round = 5;
  assert.equal(getActiveWeaponEffects(npc).length, 0);
  assert.equal(await expireWeaponEffectsOutsideCurrentRound(npc), 1);
});

test("Given a narrative Stunstick hit, when the NPC acts, then default hindrance expires", async () => {
  globalThis.game = { combat: null };
  const npc = createNpc();
  await applyWeaponTargetEffects(npc, [{ effect: "hindered", hinderSteps: 2, duration: "a round or two" }]);
  assert.equal(await expireWeaponEffectsAfterAction(npc), 1);
  assert.deepEqual(npc.flags.cypher.activeWeaponEffects, []);
});

test("Given GM adjudication, then a Stunstick effect lasts two rounds but cannot be extended again", async () => {
  globalThis.game = { user: { isGM: true }, combat: { id: "combat-stun", round: 4 } };
  const npc = createNpc();
  await applyWeaponTargetEffects(npc, [{ effect: "hindered", hinderSteps: 2, duration: "a round or two" }]);
  const id = npc.flags.cypher.activeWeaponEffects[0].id;
  assert.equal(await extendWeaponEffect(npc, id), true);
  assert.equal(await extendWeaponEffect(npc, id), false);
  globalThis.game.combat.round = 5;
  assert.equal(getActiveWeaponEffects(npc).length, 1);
  globalThis.game.combat.round = 6;
  assert.equal(getActiveWeaponEffects(npc).length, 0);
  assert.equal(await extendWeaponEffect(npc, id), false);
});

test("Given a narrative GM extension, then the effect expires after two NPC actions", async () => {
  globalThis.game = { user: { isGM: true }, combat: null };
  const npc = createNpc();
  await applyWeaponTargetEffects(npc, [{ effect: "hindered", hinderSteps: 2, duration: "a round or two" }]);
  assert.equal(await extendWeaponEffect(npc, npc.flags.cypher.activeWeaponEffects[0].id), true);
  assert.equal(await expireWeaponEffectsAfterAction(npc), 0);
  assert.equal(getActiveWeaponEffects(npc).length, 1);
  assert.equal(await expireWeaponEffectsAfterAction(npc), 1);
});

test("Given a player or an unrelated duration, then extension changes nothing", async () => {
  const npc = createNpc([{ id: "one", duration: "one round", combatId: null }]);
  globalThis.game = { user: { isGM: true }, combat: null };
  assert.equal(await extendWeaponEffect(npc, "one"), false);
  npc.flags.cypher.activeWeaponEffects = [{ id: "stun", duration: "a round or two", combatId: null }];
  globalThis.game.user.isGM = false;
  assert.equal(await extendWeaponEffect(npc, "stun"), false);
  assert.equal(npc.updates.length, 0);
});

test("Given a GM without ownership of the affected NPC, then extension cannot persist a change", async () => {
  globalThis.game = { user: { isGM: true }, combat: null };
  const npc = createNpc([{ id: "stun", duration: "a round or two", combatId: null }]);
  npc.isOwner = false;
  assert.equal(await extendWeaponEffect(npc, "stun"), false);
  assert.equal(npc.updates.length, 0);
});

const stunstickHindrance = {
  minimumTargetLevel: 3, maximumTargetLevel: null,
  effect: "hindered", hinderSteps: 2, duration: "a round or two"
};

// CRD Science Fiction Equipment does not specify stacking. The accepted user
// adjudication keeps two steps and the latest expiry, including a GM extension.
test("Given repeated Stunstick hits from different weapons, then one two-step effect persists", async () => {
  globalThis.game = { combat: { id: "stun", round: 4 } };
  const npc = createNpc();
  await applyWeaponTargetEffects(npc, [stunstickHindrance], { itemId: "first" });
  await applyWeaponTargetEffects(npc, [stunstickHindrance], { itemId: "second" });
  assert.equal(npc.flags.cypher.activeWeaponEffects.length, 1);
  assert.equal(getActiveWeaponEffects(npc).reduce((steps, effect) => steps + effect.hinderSteps, 0), 2);
});

test("Given an extended Stunstick effect, then a later default hit preserves the latest expiry", async () => {
  globalThis.game = { user: { isGM: true }, combat: { id: "stun", round: 4 } };
  const npc = createNpc();
  await applyWeaponTargetEffects(npc, [stunstickHindrance]);
  const id = getActiveWeaponEffects(npc)[0].id;
  await extendWeaponEffect(npc, id);
  globalThis.game.combat.round = 5;
  await applyWeaponTargetEffects(npc, [stunstickHindrance]);
  assert.equal(npc.flags.cypher.activeWeaponEffects.length, 1);
  assert.equal(getActiveWeaponEffects(npc)[0].roundCount, 2);
  assert.equal(await extendWeaponEffect(npc, id), false);
  globalThis.game.combat.round = 6;
  assert.equal(getActiveWeaponEffects(npc).length, 0);
});

test("Given legacy overlapping Stunstick flags, then only the latest expiry applies without rewriting on read", async () => {
  globalThis.game = { combat: { id: "stun", round: 5 } };
  const npc = createNpc([
    { ...stunstickHindrance, id: "old", combatId: "stun", combatRound: 4, roundCount: 2 },
    { ...stunstickHindrance, id: "new", combatId: "stun", combatRound: 5, roundCount: 2 }
  ]);
  assert.deepEqual(getActiveWeaponEffects(npc).map(effect => effect.id), ["new"]);
  assert.equal(npc.updates.length, 0);
  globalThis.game.combat.round = 6;
  assert.equal(getActiveWeaponEffects(npc).length, 1);
  globalThis.game.combat.round = 7;
  assert.equal(getActiveWeaponEffects(npc).length, 0);
});

test("Given an expired Stunstick effect, then another hit starts a fresh one-round interval", async () => {
  globalThis.game = { combat: { id: "stun", round: 4 } };
  const npc = createNpc();
  await applyWeaponTargetEffects(npc, [stunstickHindrance]);
  globalThis.game.combat.round = 5;
  await applyWeaponTargetEffects(npc, [stunstickHindrance]);
  assert.equal(npc.flags.cypher.activeWeaponEffects.length, 1);
  assert.equal(getActiveWeaponEffects(npc)[0].combatRound, 5);
  globalThis.game.combat.round = 6;
  assert.equal(getActiveWeaponEffects(npc).length, 0);
});

test("Given narrative Stunstick hits, then the GM's remaining two actions are not shortened", async () => {
  globalThis.game = { user: { isGM: true }, combat: null };
  const npc = createNpc();
  await applyWeaponTargetEffects(npc, [stunstickHindrance]);
  await extendWeaponEffect(npc, getActiveWeaponEffects(npc)[0].id);
  await applyWeaponTargetEffects(npc, [stunstickHindrance]);
  assert.equal(npc.flags.cypher.activeWeaponEffects.length, 1);
  assert.equal(getActiveWeaponEffects(npc)[0].narrativeRoundsRemaining, 2);
  assert.equal(await expireWeaponEffectsAfterAction(npc), 0);
  assert.equal(await expireWeaponEffectsAfterAction(npc), 1);
});

test("Given an unrelated hindrance alongside repeated Stunstick hits, then its independent contract is preserved", async () => {
  globalThis.game = { combat: { id: "stun", round: 4 } };
  const npc = createNpc();
  const unrelated = { effect: "hindered", hinderSteps: 1, duration: "one round" };
  await applyWeaponTargetEffects(npc, [stunstickHindrance, unrelated]);
  await applyWeaponTargetEffects(npc, [stunstickHindrance]);
  assert.equal(getActiveWeaponEffects(npc).length, 2);
  assert.equal(getActiveWeaponEffects(npc).reduce((steps, effect) => steps + effect.hinderSteps, 0), 3);
});
