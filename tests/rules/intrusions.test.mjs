import assert from "node:assert/strict";
import test from "node:test";
import { intrusionXPPlan, intrusionReactionIsCurrent } from "../../module/rules/intrusions.mjs";

test("a paid GM intrusion gives one net XP to each of two different players' PCs", () => {
  assert.deepEqual(intrusionXPPlan("gm", { distinctActor: true, distinctPlayer: true }), [1, 1]);
  assert.equal(intrusionXPPlan("gm", { distinctActor: true }), null);
  assert.equal(intrusionXPPlan("gm", { distinctPlayer: true }), null);
});

test("a free GM intrusion never awards XP and a player intrusion requires one available XP", () => {
  assert.deepEqual(intrusionXPPlan("gmFree"), []);
  assert.deepEqual(intrusionXPPlan("player", { xp: 1 }), [-1]);
  for (const xp of [0, -1, NaN, Infinity, 1.5]) assert.equal(intrusionXPPlan("player", { xp }), null);
  assert.equal(intrusionXPPlan("unknown"), null);
});

test("a reaction is limited to the next primary turn, independent of action usage", () => {
  const end = { combatId: "combat", combatantId: "pc", turnRevision: 3 };
  const clock = { ...end, phase: "normal", rewound: false };
  assert.equal(intrusionReactionIsCurrent(end, clock), true);
  for (const patch of [{ turnRevision: 2 }, { turnRevision: 4 }, { phase: "followUp" }, { combatantId: "other" }, { rewound: true }]) {
    assert.equal(intrusionReactionIsCurrent(end, { ...clock, ...patch }), false);
  }
});
