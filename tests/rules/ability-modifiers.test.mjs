import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveActiveAbilityModifiers
} from "../../module/rules/ability-modifiers.mjs";

test("active Ability modifiers aggregate structured self effects", () => {
  const modifiers = resolveActiveAbilityModifiers(
    [{ itemUuid: "Actor.pc.Item.frenzy", effectId: "base" }],
    [{
      uuid: "Actor.pc.Item.frenzy",
      type: "ability",
      system: {
        effects: [{
          id: "base",
          modifiers: [
            { kind: "edge", stat: "might", severity: "", amount: 1 },
            { kind: "edge", stat: "speed", severity: "", amount: 1 }
          ]
        }]
      }
    }]
  );

  assert.deepEqual(modifiers.edge, {
    might: 1,
    speed: 1,
    intellect: 0
  });
});

test("unsupported Ability modifiers do not create runtime changes", () => {
  const modifiers = resolveActiveAbilityModifiers(
    [{ itemUuid: "Actor.pc.Item.test", effectId: "base" }],
    [{
      uuid: "Actor.pc.Item.test",
      type: "ability",
      system: {
        effects: [{
          id: "base",
          modifiers: [
            { kind: "futureMechanic", stat: "", severity: "", amount: 2 }
          ]
        }]
      }
    }]
  );

  assert.deepEqual(modifiers.edge, {
    might: 0,
    speed: 0,
    intellect: 0
  });
});
