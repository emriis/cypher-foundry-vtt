import assert from "node:assert/strict";
import test from "node:test";
import { contentIdentityShape, localizedPairingMechanicalShape } from "../../scripts/source-migration/identity.mjs";

test("Given distinct CRD definitions with unmodelled rules, then normalization must not equate them from partial fields", () => {
  const shared = { tier: 1, enabler: false, cost: { stat: "intellect", amount: 3, options: [] }, action: null };
  // CRD Basic Necromancy: the Necromancer Type and Consorts With the Dead
  // Focus differ in reanimation conditions and action timing. Current fields
  // do not encode all those differences; English source text must be retained.
  const typeDefinition = { ...shared, description: "Unless the creature is killed by damage, you can reanimate it again when its time expires. Action to animate." };
  const focusDefinition = { ...shared, description: "You can reanimate it again when it becomes inert or if it is “killed” by damage. Last action to animate." };
  assert.notDeepEqual(contentIdentityShape(typeDefinition), contentIdentityShape(focusDefinition));
  // Localization is not a mechanical variant. Pairing still uses explicit
  // document references/IDs and the editorial-free mechanical comparison.
  assert.deepEqual(localizedPairingMechanicalShape(typeDefinition), localizedPairingMechanicalShape(focusDefinition));
  assert.deepEqual(contentIdentityShape(typeDefinition), contentIdentityShape({
    ...typeDefinition, description: `<p>${typeDefinition.description}</p>`
  }), "HTML formatting cannot create a new rule definition");
});
