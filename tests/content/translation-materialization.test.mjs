/** Compilation never silently approves drafts or changes source rule data. */
import assert from "node:assert/strict";
import test from "node:test";
import { sourceHash, translationFields } from "../../scripts/localization/compendium-translations.mjs";
import { materializeTranslations } from "../../scripts/localization/materialize-translations.mjs";

function fixture() {
  const english = { _id: "englishIdentity", name: "Example", type: "ability",
    system: { description: "<p>Spend 3 points.</p>", cost: { stat: "intellect", amount: 3 } },
    flags: { cypherFoundry: { crd: { logicalId: "ability.example", language: "en" } } } };
  const french = structuredClone(english);
  french._id = "frenchIdentity";
  Object.assign(french.flags.cypherFoundry.crd, { language: "fr", sourceLogicalId: "ability.example",
    transformations: ["English source retained pending French translation", "Source formatting converted to HTML"] });
  const records = [{ pack: "abilities-en", file: "en.json", logicalId: "ability.example", document: english },
    { pack: "abilities-fr", file: "fr.json", logicalId: "ability.example", document: french }];
  const translations = { name: "Exemple", "system.description": "<p>Dépensez 3 points.</p>" };
  const proposal = { logicalId: "ability.example", sourceLogicalId: "ability.example", language: "fr", status: "proposed",
    fields: [...translationFields(english)].map(([path, source]) => ({ path, sourceHash: sourceHash(source), text: translations[path] })) };
  return { records, proposals: new Map([["ability.example", { proposal }]]) };
}

test("Given a proposed complete translation, when production or draft compilation selects text, then review status is respected and source documents stay unchanged", () => {
  const { records, proposals } = fixture();
  assert.equal(materializeTranslations(records, proposals).size, 0);
  const result = materializeTranslations(records, proposals, { includeProposed: true }).get("fr.json");
  assert.equal(result.name, "Exemple");
  assert.equal(result.flags.cypherFoundry.translation.status, "proposed");
  assert.equal(result.flags.cypherFoundry.crd.transformations.includes("English source retained pending French translation"), false);
  assert.ok(result.flags.cypherFoundry.crd.transformations.includes("Source formatting converted to HTML"));
  assert.equal(result._id, "frenchIdentity");
  assert.deepEqual(result.system.cost, records[0].document.system.cost);
  assert.equal(records[1].document.name, "Example");
  assert.ok(records[1].document.flags.cypherFoundry.crd.transformations.includes("English source retained pending French translation"));
  assert.equal(proposals.get("ability.example").proposal.status, "proposed");
  proposals.get("ability.example").proposal.status = "reviewed";
  assert.equal(materializeTranslations(records, proposals).get("fr.json").flags.cypherFoundry.translation.status, "reviewed");
});

test("Given missing, stale, duplicate or mechanically divergent data, when compilation is planned, then it fails before returning a partial plan", () => {
  const { records, proposals } = fixture();
  const draft = { includeProposed: true };
  assert.throws(() => materializeTranslations(records, new Map(), draft), /missing.*proposal/i);
  assert.throws(() => materializeTranslations([...records, records[0]], proposals, draft), /duplicate.*identity/i);
  proposals.get("ability.example").proposal.fields[0].sourceHash = "stale";
  assert.throws(() => materializeTranslations(records, proposals, draft), /stale.*name/i);
  proposals.get("ability.example").proposal.fields[0].sourceHash = sourceHash("Example");
  records[1].document.system.cost.amount = 4;
  assert.throws(() => materializeTranslations(records, proposals, draft), /mechanical.*differs/i);
  assert.equal(records[1].document.name, "Example");
});

test("Given an ambiguous embedded ID, when translation fields are inventoried, then a selector cannot hide a second effect", () => {
  assert.throws(() => translationFields({ system: { effects: [{ id: "same", name: "First" }, { id: "same", name: "Second" }] } }), /duplicate scoped ID/i);
});

test("Given coherent translated skill names, when compilation changes a granted label, then it must still refer to the corresponding CRD Skill", () => {
  const { records, proposals } = fixture();
  const englishSkill = { _id: "englishSkill", name: "Athletics", type: "skill", system: { description: "<p>Athletics.</p>" },
    flags: { cypherFoundry: { crd: { logicalId: "skill.athletics", language: "en" } } } };
  const frenchSkill = structuredClone(englishSkill);
  frenchSkill._id = "frenchSkill";
  Object.assign(frenchSkill.flags.cypherFoundry.crd, { language: "fr", sourceLogicalId: "skill.athletics" });
  records.push({ pack: "skills-en", file: "skill-en.json", logicalId: "skill.athletics", document: englishSkill },
    { pack: "skills-fr", file: "skill-fr.json", logicalId: "skill.athletics", document: frenchSkill });
  const skill = { logicalId: "skill.athletics", sourceLogicalId: "skill.athletics", language: "fr", status: "proposed",
    fields: [{ path: "name", sourceHash: sourceHash("Athletics"), text: "Athlétisme" },
      { path: "system.description", sourceHash: sourceHash("<p>Athletics.</p>"), text: "<p>Athlétisme.</p>" }] };
  proposals.set("skill.athletics", { proposal: skill });
  records[0].document.system.grantedSkills = ["Athletics"];
  records[1].document.system.grantedSkills = ["Athletics"];
  const field = { path: "system.grantedSkills.0", sourceHash: sourceHash("Athletics"), text: "Athlétisme" };
  proposals.get("ability.example").proposal.fields.push(field);
  assert.equal(materializeTranslations(records, proposals, { includeProposed: true }).get("fr.json").system.grantedSkills[0], "Athlétisme");
  field.text = "Acrobaties";
  assert.throws(() => materializeTranslations(records, proposals, { includeProposed: true }), /skill.*label.*athletics/i);
});
