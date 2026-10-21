import assert from "node:assert/strict";
import test from "node:test";
import { generalEffectIsActive, helpAssets, resolveGeneralModifiers } from "../../module/rules/general-effects.mjs";

test("source-turn expiry survives reload and initiative reordering, and rejects other combats", () => {
  const effect = { kind: "defenseHelp", until: { combatId: "combat", combatantId: "helper", round: 3 } };
  assert.equal(generalEffectIsActive(effect, { id: "combat", round: 2, turn: 2, turns: ["ally", "foe", "helper"] }), true);
  assert.equal(generalEffectIsActive(effect, { id: "combat", round: 3, turn: 0, turns: ["foe", "helper", "ally"] }), true);
  assert.equal(generalEffectIsActive(effect, { id: "combat", round: 3, turn: 1, turns: ["foe", "helper", "ally"] }), false);
  assert.equal(generalEffectIsActive(effect, { id: "other", round: 1, turn: 0, turns: ["helper"] }), false);
  assert.equal(generalEffectIsActive(effect, {}), false);
});

test("help distinguishes inability, untrained and every positive training level", () => {
  assert.deepEqual([-1, 0, 1, 2, 3].map(helpAssets), [0, 1, 2, 2, 2]);
});

test("dazed affects every task, guarding eases all defenses and blocks attacks", () => {
  const effects = [{ kind: "dazed" }, { kind: "guarding" }];
  assert.equal(resolveGeneralModifiers(effects).hinder, 1);
  assert.equal(resolveGeneralModifiers(effects, [], { isDefense: true }).ease, 1);
  assert.equal(resolveGeneralModifiers(effects, [], { isAttack: true }).rejected, true);
});

test("paralysis permits explicitly motionless actions; stun permits only defense", () => {
  assert.equal(resolveGeneralModifiers([{ kind: "paralyzed" }]).rejected, true);
  assert.equal(resolveGeneralModifiers([{ kind: "paralyzed" }], [], { noPhysicalMovement: true }).rejected, false);
  assert.equal(resolveGeneralModifiers([{ kind: "stunned" }], [], { isDefense: true }).rejected, false);
  assert.equal(resolveGeneralModifiers([{ kind: "stunned" }], [], { noPhysicalMovement: true }).rejected, true);
});

test("prone depends on explicit melee/ranged context, never Pool or token coordinates", () => {
  const prone = [{ kind: "prone" }];
  assert.equal(resolveGeneralModifiers([], prone, { isAttack: true }).ease, 0);
  assert.equal(resolveGeneralModifiers([], prone, { isAttack: true, attackForm: "melee" }).ease, 1);
  assert.equal(resolveGeneralModifiers([], prone, { isAttack: true, attackForm: "ranged" }).hinder, 1);
  assert.equal(resolveGeneralModifiers(prone, [], { isDefense: true, attackForm: "melee" }).hinder, 1);
});
