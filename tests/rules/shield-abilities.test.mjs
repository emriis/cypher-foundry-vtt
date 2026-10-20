/** CRD 3425–3429, 4256–4259, 4971–4974 and 4985–4987. */
import test from "node:test";
import assert from "node:assert/strict";
import { shieldAbilityKind, shieldSurvivesMajor, validShieldTargets } from "../../module/rules/shield-abilities.mjs";

test("only a shield designated for its owner's Unyielding Shield survives a major wound", () => {
  const ability = { id: "a", type: "ability", name: "Localized", system: { key: "unyielding-shield" } };
  const shield = { system: { abilityItemId: "a" } };
  assert.equal(shieldSurvivesMajor(shield, [ability]), true);
  assert.equal(shieldSurvivesMajor({ system: {} }, [ability]), false);
  assert.equal(shieldSurvivesMajor(shield, []), false);
  assert.equal(shieldAbilityKind(shield, [{ ...ability, system: { key: "hidden-shield" } }]), "hidden-shield");
});

test("Bouncing Shield permits revisiting only the first target on its third attack", () => {
  assert.equal(validShieldTargets("bouncing-shield", ["a", "b", "a"]), true);
  assert.equal(validShieldTargets("bouncing-shield", ["a", "b", "c"]), true);
  assert.equal(validShieldTargets("bouncing-shield", ["a", "a", "b"]), false);
  assert.equal(validShieldTargets("bouncing-shield", ["a", "b", "b"]), false);
  assert.equal(validShieldTargets("throw-shield", ["a"]), true);
});
