/** Canonical rules and references survive independent language editing. */
import assert from "node:assert/strict";
import test from "node:test";
import { alignFrenchRuleData } from "../../scripts/source-migration/bilingual-mechanics.mjs";

test("Given stale translated activation fields, when bilingual data is aligned, then CRD-backed typed fields win and French prose survives", () => {
  const english = { type: "ability", system: { key: "sense", action: "lastAction", enabler: false,
    cost: { amount: 1, stat: "intellect" }, description: "Sense psionics. Last action." } };
  const french = { _id: "FrenchIdentity", name: "Détection", type: "ability", system: { key: "sense", action: "action", enabler: true,
    cost: { amount: 2, stat: "intellect" }, description: "Détectez les phénomènes psioniques. Dernière action." } };
  const result = alignFrenchRuleData(english, french);
  assert.equal(result.system.action, "lastAction");
  assert.equal(result.system.enabler, false);
  assert.deepEqual(result.system.cost, english.system.cost);
  assert.equal(result.system.description, french.system.description);
  assert.equal(result._id, french._id);
  assert.equal(result.name, "Détection");
  assert.equal(french.system.action, "action");
});

test("Given different bilingual Ability IDs, when Type and Focus rules are aligned, then references and edges resolve to French counterparts", () => {
  const english = { type: "focus", system: {
    description: "A focus.", abilities: ["Compendium.cypher.abilities-en.Item.englishAbility"],
    flowchart: { edges: [{ from: "englishAbility", to: "englishOther" }] }
  } };
  const french = { type: "focus", system: { description: "Un focus.", abilities: [], flowchart: { edges: [] } } };
  const references = new Map([
    ["Compendium.cypher.abilities-en.Item.englishAbility", "Compendium.cypher.abilities-fr.Item.frenchAbility"]
  ]);
  const ids = new Map([["englishAbility", "frenchAbility"], ["englishOther", "frenchOther"]]);
  const result = alignFrenchRuleData(english, french, { references, abilityIds: ids });
  assert.deepEqual(result.system.abilities, ["Compendium.cypher.abilities-fr.Item.frenchAbility"]);
  assert.deepEqual(result.system.flowchart.edges, [{ from: "frenchAbility", to: "frenchOther" }]);
  assert.throws(() => alignFrenchRuleData(english, french), /unresolved.*Compendium/i);
});

test("Given independently translated embedded choices, when rules align, then only corresponding display fields are retained", () => {
  const english = { type: "ability", system: { description: "Rules", effects: [
    { id: "choice", name: "Choice", description: "Gain 2 points.", amount: 2 }
  ] } };
  const french = { type: "ability", system: { description: "Règles", effects: [
    { id: "choice", name: "Choix", description: "Gagnez 2 points.", amount: 8 }
  ] } };
  const result = alignFrenchRuleData(english, french);
  assert.equal(result.system.effects[0].name, "Choix");
  assert.equal(result.system.effects[0].amount, 2);
});
