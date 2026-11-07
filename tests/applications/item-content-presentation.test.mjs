/** Sheets consume actual Ability Documents, whose display/rule fields live in system. */
import test from "node:test";
import assert from "node:assert/strict";
import { CYPHER } from "../../module/config.mjs";

class ItemSheet {
  constructor(item) { this.item = item; }
  async _prepareContext() { return {}; }
}
globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: value => value },
  sheets: { ItemSheetV2: ItemSheet }, ux: { TextEditor: { implementation: { enrichHTML: async text => text } } } } };
globalThis.CONFIG = { CYPHER };
const { default: CypherItemSheet } = await import("../../module/sheets/item-sheet.mjs");

function setup() {
  globalThis.game = { i18n: { prefix: "localized:",
    localize(key) { return this.prefix + key; },
    format(key, data) { return this.prefix + key + JSON.stringify(data); }
  } };
  const document = (id, name, system) => Object.defineProperties({ type: "ability", system }, {
    id: { get: () => id }, name: { get: () => name }, uuid: { get: () => `Ability.${id}` }
  });
  const first = document("first", "First Ability", { tier: 1, cost: { amount: 3, stat: "intellect" },
    enabler: true, repeatable: true, description: "<p>Complete first description.</p>" });
  const second = document("second", "Second Ability", { tier: 2, cost: { amount: 4, stat: "choice", options: ["might", "speed"] },
    action: "firstAction", description: "<p>Complete second description.</p>" });
  globalThis.fromUuid = async uuid => new Map([["Ability.first", first], ["Ability.second", second]]).get(uuid);
  return { abilities: ["Ability.first", "Ability.second"], flowchart: { edges: [{ from: "first", to: "second" }] } };
}

test("Focus presentation keeps document names, system tiers/costs and contextual prerequisites with bound localization", async () => {
  const system = setup();
  const context = await new CypherItemSheet({ type: "focus", system })._prepareContext({});
  assert.deepEqual(context.focusView.tiers.map(row => row.abilities.map(ability => ability.name)), [["First Ability"], ["Second Ability"]]);
  const [first, second] = context.focusView.tiers.flatMap(tier => tier.abilities);
  assert.match(first.costLabel, /"amount":3/);
  assert.equal(first.enabler, true);
  assert.equal(first.repeatable, true);
  assert.equal(first.enrichedDescription, "<p>Complete first description.</p>");
  assert.deepEqual(second.prerequisites, ["First Ability"]);
  assert.equal(second.actionLabel, "localized:CYPHER.Ability.ActionFirst");
  assert.match(second.costOptionsLabel, /localized:CYPHER.Stat.might, localized:CYPHER.Stat.speed/);
});

test("Type presentation uses the same actual Document field boundary instead of showing free unnamed abilities", async () => {
  const system = setup();
  system.abilityTiers = [{ ability: "Ability.second", tier: 3 }];
  const context = await new CypherItemSheet({ type: "type", system })._prepareContext({});
  assert.deepEqual(context.typeView.abilities.map(ability => ability.name), ["First Ability", "Second Ability"]);
  assert.match(context.typeView.abilities[0].costLabel, /"amount":3/);
  assert.match(context.typeView.abilities[1].tierLabel, /"tier":3/);
  assert.equal(context.typeView.abilities[1].enrichedDescription, "<p>Complete second description.</p>");
});
