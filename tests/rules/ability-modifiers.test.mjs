import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveActiveAbilityModifiers, resolveAbilityWoundTrack
} from "../../module/rules/ability-modifiers.mjs";

test("explicit passive capacity applies without activation and disappears with the Item", () => {
  // CRD 2026-07-29 > Fantasy Genre > Mid-Tier Fantasy Abilities > Tough.
  const item = { type: "ability", system: { passiveModifiers: [
    { kind: "woundCapacity", severity: "minor", amount: 1 }
  ] } };
  const wounds = { minor: { current: 3, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 1 } };
  assert.equal(resolveActiveAbilityModifiers([], [item]).woundCapacity.minor, 1);
  assert.equal(resolveAbilityWoundTrack(wounds, [], [item]).minor.max, 4);
  assert.equal(resolveAbilityWoundTrack(wounds, [], []).minor.max, 3);
  assert.equal(wounds.minor.max, 3);
  assert.equal(resolveActiveAbilityModifiers([], [{ ...item, type: "equipment" }]).woundCapacity.minor, 0);
});

test("names and enabler labels never infer passive modifiers; malformed units are ignored", () => {
  const result = resolveActiveAbilityModifiers([], [
    { type: "ability", name: "Tough", system: { key: "tough", enabler: true } },
    { type: "ability", system: { passiveModifiers: [
      { kind: "woundCapacity", severity: "minor", amount: "1" },
      { kind: "woundCapacity", severity: "minor", amount: NaN },
      { kind: "edge", stat: "might", amount: 0.5 }
    ] } }
  ]);
  assert.equal(result.woundCapacity.minor, 0);
  assert.equal(result.edge.might, 0);
});

test("Armored Body capacity requires its explicit rank-two minimum", () => {
  const body = { type: "ability", system: { passiveModifiers: [
    { kind: "woundCapacity", severity: "moderate", amount: 1, minimumRank: 2 },
    { kind: "woundCapacity", severity: "major", amount: 1, minimumRank: 2 }
  ] } };
  assert.equal(resolveActiveAbilityModifiers([], [body], { rank: 1 }).woundCapacity.moderate, 0);
  assert.equal(resolveActiveAbilityModifiers([], [body], { rank: 2 }).woundCapacity.moderate, 1);
  assert.equal(resolveActiveAbilityModifiers([], [body], { rank: 5 }).woundCapacity.major, 1);
  assert.equal(resolveActiveAbilityModifiers([], [body]).woundCapacity.major, 0);
});

test("Shield Master adds shield capacity without adding PC capacity", () => {
  const item = { type: "ability", system: { passiveModifiers: [
    { kind: "shieldWoundCapacity", severity: "moderate", amount: 1 }
  ] } };
  const modifiers = resolveActiveAbilityModifiers([], [item]);
  assert.equal(modifiers.shieldWoundCapacity?.moderate, 1);
  assert.equal(modifiers.woundCapacity.moderate, 0);
});

test("same-severity capacity grants do not stack; different severities and recipients coexist", () => {
  const items = [
    { uuid: "Actor.pc.Item.stone", type: "ability", system: { passiveModifiers: [
      { kind: "woundCapacity", severity: "minor", amount: 2 },
      { kind: "woundCapacity", severity: "moderate", amount: 1 }
    ], effects: [{ id: "capacity", modifiers: [{ kind: "woundCapacity", severity: "minor", amount: 1 }] }] } },
    { type: "ability", system: { passiveModifiers: [
      { kind: "woundCapacity", severity: "minor", amount: 1 },
      { kind: "woundCapacity", severity: "moderate", amount: 1 },
      { kind: "woundCapacity", severity: "major", amount: 1 },
      { kind: "shieldWoundCapacity", severity: "moderate", amount: 1 }
    ] } }
  ];
  const references = [{ itemUuid: items[0].uuid, effectId: "capacity" }];
  for (const order of [items, [...items].reverse(), [...items, items[1]]]) {
    const modifiers = resolveActiveAbilityModifiers(references, order);
    assert.deepEqual(modifiers.woundCapacity, { minor: 2, moderate: 1, major: 1 });
    assert.equal(modifiers.shieldWoundCapacity.moderate, 1);
  }
});

test("one extra minor wound and one extra moderate wound both apply", () => {
  const ability = severity => ({ type: "ability", system: { passiveModifiers: [
    { kind: "woundCapacity", severity, amount: 1 }
  ] } });
  const modifiers = resolveActiveAbilityModifiers([], [ability("minor"), ability("moderate"), ability("minor")]);
  assert.deepEqual(modifiers.woundCapacity, { minor: 1, moderate: 1, major: 0 });
});

test("species and Descriptor capacity adds outside the shared genre/Type/Focus group", () => {
  const ability = (kind, amount) => ({ type: "ability", name: "Same localized label",
    flags: { cypher: { grantOrigin: { kind, sourceId: kind } } },
    system: { passiveModifiers: [{ kind: "woundCapacity", severity: "minor", amount }] }
  });
  const items = [ability("genre", 1), ability("type", 2), ability("focus", 1),
    ability("species", 1), ability("descriptor", 1)];
  for (const order of [items, [...items].reverse()]) {
    assert.equal(resolveActiveAbilityModifiers([], order).woundCapacity.minor, 4);
    const wounds = { minor: { current: 0, max: 3 } };
    assert.equal(resolveAbilityWoundTrack(wounds, [], order).minor.max, 7);
    assert.equal(wounds.minor.max, 3);
  }
});

test("an active species effect retains its additive origin alongside passive Ability grants", () => {
  const species = { uuid: "Actor.pc.Item.species", type: "ability",
    flags: { cypher: { grantOrigin: { kind: "species", sourceId: "species" } } },
    system: { effects: [{ id: "capacity", modifiers: [{ kind: "woundCapacity", severity: "moderate", amount: 1 }] }] }
  };
  const normal = { type: "ability", system: { passiveModifiers: [{ kind: "woundCapacity", severity: "moderate", amount: 1 }] } };
  const modifiers = resolveActiveAbilityModifiers([{ itemUuid: species.uuid, effectId: "capacity" }], [species, normal]);
  assert.equal(modifiers.woundCapacity.moderate, 2);
});

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

test("active Ability modifiers sum Pool maxima but do not duplicate wound-capacity grants", () => {
  const modifiers = resolveActiveAbilityModifiers(
    [
      { itemUuid: "Actor.pc.Item.guardian", effectId: "base" },
      { itemUuid: "Actor.pc.Item.guardian", effectId: "ward" }
    ],
    [{
      uuid: "Actor.pc.Item.guardian",
      type: "ability",
      system: {
        effects: [
          {
            id: "base",
            modifiers: [
              { kind: "poolMax", stat: "might", amount: 2 },
              { kind: "woundCapacity", severity: "minor", amount: 1 }
            ]
          },
          {
            id: "ward",
            modifiers: [
              { kind: "poolMax", stat: "might", amount: 1 },
              { kind: "woundCapacity", severity: "minor", amount: 1 }
            ]
          }
        ]
      }
    }]
  );

  assert.equal(modifiers.poolMax.might, 3);
  assert.equal(modifiers.woundCapacity.minor, 1);
  assert.equal(modifiers.poolMax.speed, 0);
});

test("duplicate runtime references do not stack the same Ability effect twice", () => {
  const modifiers = resolveActiveAbilityModifiers(
    [
      { itemUuid: "Actor.pc.Item.guardian", effectId: "base" },
      { itemUuid: "Actor.pc.Item.guardian", effectId: "base" }
    ],
    [{
      uuid: "Actor.pc.Item.guardian",
      type: "ability",
      system: {
        effects: [{
          id: "base",
          modifiers: [
            { kind: "edge", stat: "might", amount: 1 }
          ]
        }]
      }
    }]
  );

  assert.equal(modifiers.edge.might, 1);
});
