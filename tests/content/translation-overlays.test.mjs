/** Translation changes presentation while preserving the canonical rule-bearing fields. */
import assert from "node:assert/strict";
import test from "node:test";
import { applyTranslation, sourceHash, translationFields, translationSafetyErrors } from "../../scripts/localization/compendium-translations.mjs";

const english = {
  _id: "0123456789abcdef", name: "Example", type: "ability",
  flags: { cypherFoundry: { crd: { logicalId: "ability.example", language: "en" } } },
  system: { key: "example", cost: { amount: 3, stat: "intellect" },
    description: "<p>Spend 3 points; roll 1d6.</p>",
    effects: [{ id: "choice", name: "Choice", description: "<p>Gain 2 points.</p>", effort: "" }],
    rollTables: [{ id: "result", name: "Result", formula: "1d6", results: [{ min: 1, max: 6, description: "Nothing happens." }] }]
  }
};
const french = structuredClone(english);
french.flags.cypherFoundry.crd.language = "fr";
french.flags.cypherFoundry.crd.sourceLogicalId = "ability.example";
const translations = {
  name: "Exemple", "system.description": "<p>Dépensez 3 points ; lancez 1d6.</p>",
  "system.effects.choice.name": "Choix", "system.effects.choice.description": "<p>Gagnez 2 points.</p>",
  "system.rollTables.result.name": "Résultat", "system.rollTables.result.results.0.description": "Il ne se passe rien."
};
function proposal() {
  return { logicalId: "ability.example", sourceLogicalId: "ability.example", language: "fr", status: "proposed",
    fields: Object.entries(translations).map(([path, text]) => ({ path, text, sourceHash: sourceHash(translationFields(english).get(path)) })) };
}

test("Given a complete French proposal, when it is applied, then stable identities and mechanical data stay unchanged", () => {
  const translated = applyTranslation(english, french, proposal());
  assert.equal(translated.name, "Exemple");
  assert.equal(translated.system.effects[0].name, "Choix");
  assert.deepEqual(translated.system.cost, english.system.cost);
  assert.equal(translated.system.key, "example");
  assert.equal(translated.system.rollTables[0].formula, "1d6");
  assert.deepEqual(translated.system.rollTables[0].results[0].min, 1);
  assert.equal(translated._id, french._id);
  assert.equal(french.name, "Example", "Applying a proposal must not mutate its input.");
});

test("Given adjacent table cells, when numeric fidelity is checked, then markup does not concatenate unrelated numbers", () => {
  assert.deepEqual(translationSafetyErrors("<td>50/50.</td><td>4</td>", "<td>50/50.</td><td>4</td>", "table"), []);
  assert.deepEqual(translationSafetyErrors("<td>A 50/50.</td><td>4</td>", "<td>50/50, selon le cas.</td><td>4</td>", "table"), []);
});

for (const [source, translated, error] of [
  ["Roll 1d6", "Lancez 6d1", /dice/],
  ["@UUID[Item.abc]", "@UUID[Item.def]", /references/],
  ["Hello {name}", "Bonjour {other}", /references/]
]) {
  test(`translation independently rejects ${error.source}: ${source}`, () => {
    assert.match(translationSafetyErrors(source, translated, "example").join(" "), error);
  });
}
test("reference and placeholder reordering preserves the translation contract", () => {
  assert.deepEqual(translationSafetyErrors("{name} @UUID[Item.abc] {count}", "{count} @UUID[Item.abc] {name}", "example"), []);
});

test("Given locale-specific numeric punctuation, when fidelity is checked, then equivalent quantities are accepted", () => {
  assert.deepEqual(translationSafetyErrors("1.5 m and 1,000 points", "1,5 m et 1\u202f000 points", "measurements"), []);
  assert.match(translationSafetyErrors("1.5 m and 1,000 points", "1,5 m et 1,000 points", "measurements").join(" "), /numeric/);
});

test("Given stale source wording or a mechanical edit, when a proposal is applied, then it is rejected before mutation", () => {
  const stale = proposal();
  stale.fields[0].sourceHash = "0".repeat(64);
  assert.throws(() => applyTranslation(english, french, stale), /stale.*name/i);
  const mechanics = proposal();
  mechanics.fields.push({ path: "system.cost.amount", sourceHash: sourceHash("3"), text: "4" });
  assert.throws(() => applyTranslation(english, french, mechanics), /not translatable.*cost.amount/i);
  const loss = proposal();
  loss.fields[1].text = "<p>Lancez 1d6.</p>";
  assert.throws(() => applyTranslation(english, french, loss), /system.description.*numeric/i);
  assert.equal(french.system.cost.amount, 3);
});

test("Given omitted fields, altered markup, or a mismatched counterpart, when proposals are validated, then hidden loss is rejected", () => {
  const incomplete = proposal();
  incomplete.fields.pop();
  assert.throws(() => applyTranslation(english, french, incomplete), /missing.*results.0.description/i);
  const markup = proposal();
  markup.fields[1].text = "Dépensez 3 points ; lancez 1d6.";
  assert.throws(() => applyTranslation(english, french, markup), /system.description.*markup/i);
  const wrong = structuredClone(french);
  wrong.flags.cypherFoundry.crd.sourceLogicalId = "ability.other";
  assert.throws(() => applyTranslation(english, wrong, proposal()), /counterpart/i);
});

test("Given journal pages or structured option tables, when text is inventoried, then arrays with IDs use stable scoped identities", () => {
  const fields = translationFields({ name: "Rules", pages: [{ _id: "stablePage", name: "Tasks", text: { content: "<p>Rules.</p>" } }] });
  assert.equal(fields.get("pages.stablePage.name"), "Tasks");
  assert.equal(fields.get("pages.stablePage.text.content"), "<p>Rules.</p>");
  assert.equal(fields.has("pages.0.text.content"), false);
  assert.equal(fields.has("system.cost.stat"), false);
});
