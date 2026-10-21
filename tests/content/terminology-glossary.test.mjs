/** PR5 protects the normalized glossary and flags French style without translating rules. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readLocaleSources } from "../../scripts/build-locales.mjs";
import { validateGlossary, inclusiveStyleHints, mechanicalTerminologyHints,
  reviewFrenchStyle } from "../../scripts/localization/terminology.mjs";

const root = path.resolve(import.meta.dirname, "../..");

test("the actual canonical glossary's UI mechanical labels match all current locale domains", async () => {
  const [data, en, fr] = await Promise.all([
    fs.readFile(path.join(root, "data/localization/glossary-fr.json"), "utf8"),
    readLocaleSources(root, "en"), readLocaleSources(root, "fr")
  ]);
  const glossary = JSON.parse(data);
  assert.ok(glossary.entries.length >= 60);
  assert.deepEqual(validateGlossary(glossary, en.dictionary, fr.dictionary), []);
  assert.equal(glossary.entries.find(x => x.id === "activation.first-action").french, "Action réflexe");
  assert.equal(glossary.entries.find(x => x.id === "mechanic.edge").french, "Avantage");
  assert.equal(glossary.entries.find(x => x.id === "mechanic.asset").french, "Atout");
  assert.equal(glossary.entries.find(x => x.id === "mechanic.power-shift-power").french, "Pouvoir");
  assert.equal(glossary.entries.find(x => x.id === "stat.might").french, "Puissance");
  assert.equal(glossary.entries.find(x => x.id === "stat.intellect").french, "Intellect");
});

test("term ownership rejects a missing key, accidental synonym, duplicate glossary and unsupported status", () => {
  const glossary = { schemaVersion: 1, entries: [{
    id: "mechanic.edge", english: "Edge", french: "Avantage", status: "established",
    context: "Reduces Pool expense", uiBindings: ["CYPHER.Edge"]
  }] };
  const en = { CYPHER: { Edge: "Edge" } };
  const fr = { CYPHER: { Edge: "Avantage" } };
  assert.deepEqual(validateGlossary(glossary, en, fr), []);
  assert.match(validateGlossary(glossary, en, { CYPHER: { Edge: "Atout" } }).join("\n"),
    /CYPHER\.Edge must use glossary term Avantage/);
  assert.match(validateGlossary(glossary, en, { CYPHER: {} }).join("\n"), /missing French UI key/);
  glossary.entries.push({ ...glossary.entries[0], status: "automatically-reviewed" });
  assert.match(validateGlossary(glossary, en, fr).join("\n"), /Duplicate glossary entry/);
  assert.match(validateGlossary(glossary, en, fr).join("\n"), /invalid status/);
  assert.match(validateGlossary(glossary, en, fr).join("\n"), /multiple owners/);
});

test("inclusive writing review flags gendered generic address but protects epicene phrasing", () => {
  const findings = inclusiveStyleHints("<p>Chaque joueur doit agir ; il ou elle choisit.</p>");
  assert.ok(findings.some(x => x.id === "gendered-player-generic"));
  assert.ok(findings.some(x => x.id === "gendered-pairing"));
  assert.deepEqual(inclusiveStyleHints("<p>Vous choisissez ; la personne qui joue agit.</p>"), []);
  assert.deepEqual(inclusiveStyleHints("@UUID[Compendium.test.Item.123]"), []);
  assert.ok(inclusiveStyleHints("Entraîné(e)").some(x => x.id === "gender-parentheses"));
});

test("mechanical caveats flag possible D&D-style rolls without banning ordinary Edge wording", () => {
  assert.equal(mechanicalTerminologyHints("Avantage : réduit le coût en points de réserve.").length, 0);
  assert.ok(mechanicalTerminologyHints("Obtenez un avantage aux jets.").some(x =>
    x.id === "roll-advantage-ambiguity"));
});

test("proposed translation hints are advisory, immutable and never imply semantic approval", () => {
  const proposal = { status: "proposed", fields: [
    { path: "system.description", text: "Les joueurs tentent des actions." },
    { path: "name", text: "Aptitude" }
  ] };
  const proposals = new Map([["ability.example", { file: "abilities/example.json", proposal }]]);
  const original = structuredClone(proposal);
  const audit = reviewFrenchStyle(proposals);
  assert.equal(audit.summary.proposals, 1);
  assert.equal(audit.summary.fields, 2);
  assert.equal(audit.summary.statuses.proposed, 1);
  assert.equal(audit.findings[0].requiresHumanReview, true);
  assert.deepEqual(proposal, original);
});
