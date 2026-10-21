/**
 * PR6 content contract: all 58 Skills and 53 Descriptors/species were reviewed
 * individually against the English 2026-07-29 CRD sources. All remaining
 * translation families keep their independent editorial statuses.
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readCompendiumCatalogue, readFrenchProposals, reviewCatalogue } from "../../scripts/review-translations.mjs";
import { materializeTranslations } from "../../scripts/localization/materialize-translations.mjs";
import { sourceHash, translationFields } from "../../scripts/localization/compendium-translations.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

test("every Skill and Descriptor proposal is reviewed, complete, current and mechanically equivalent", async () => {
  const [records, proposals] = await Promise.all([
    readCompendiumCatalogue(ROOT), readFrenchProposals(ROOT)
  ]);
  const summary = reviewCatalogue(records, proposals);
  assert.deepEqual(summary.orphanedProposals, []);
  const families = [
    ["skill.", 58],
    ["descriptor.", 53]
  ];
  for (const [prefix, expected] of families) {
    const entries = summary.entries.filter(entry => entry.logicalId.startsWith(prefix));
    assert.equal(entries.length, expected, "The named CRD family inventory changed.");
    for (const entry of entries) {
      assert.equal(entry.status, "reviewed",
        entry.logicalId + " must be source-backed and approved: " + entry.errors.join("; "));
      assert.equal(entry.translatedFields, entry.sourceFields,
        entry.logicalId + " must retain every CRD-backed display field.");
      assert.equal(entry.mechanicalParity, true, entry.logicalId + " changes rule mechanics.");
      assert.deepEqual(entry.missingFields, [], entry.logicalId);
      assert.deepEqual(entry.errors, [], entry.logicalId);
    }
  }
  const actual = materializeTranslations(records, proposals);
  assert.equal(actual.size, summary.entries.length);
  const selected = [...actual.values()].filter(doc =>
    ["skill", "descriptor"].includes(doc.type));
  assert.equal(selected.length, 111);
  for (const doc of selected) {
    assert.equal(doc.flags.cypherFoundry.translation.status, "reviewed");
    assert.equal(doc.flags.cypherFoundry.translation.sourceLanguage, "fr");
  }

  const byId = new Map(records.map(row => [row.pack + ":" + row.logicalId, row.file]));
  const read = (family, logicalId) => {
    const file = byId.get(family + "-fr:" + logicalId);
    assert.ok(file, "Missing normalized French counterpart: " + logicalId);
    return actual.get(file);
  };
  const aarak = read("descriptors", "descriptor.species.aarak");
  assert.match(aarak.system.description, /30 pieds \(9 m\)/);
  assert.match(aarak.system.description, /jet d’esquive/);
  const naron = read("descriptors", "descriptor.species.naron");
  assert.deepEqual(naron.system.skillOptions, ["Charme", "Tromperie"]);
  assert.deepEqual(naron.system.grantedSkills, ["Analyse des intentions"]);
  const st = read("descriptors", "descriptor.species.stelan");
  assert.match(st.system.description, /prochain tour/);
  assert.match(st.system.description, /au lieu de lui infliger des dégâts/);
  const orc = read("descriptors", "descriptor.species.orc");
  assert.match(orc.system.description, /Adapter des Types alternatifs/);
  assert.match(orc.system.description, /Lancer des sorts/);
  assert.match(orc.system.description, /Voir dans l’obscurité/);
  const scavenging = read("skills", "skill.scavenging");
  assert.match(scavenging.system.description, /<table>/);
  assert.match(scavenging.system.description, /par tranche de deux personnes/);
});

test("unreviewed parent retains English Skill references until its own review", () => {
  const ability = (type, lang, logicalId, name, system) => ({
    document: "Item", type, name, _id: logicalId.replaceAll(".", "").padEnd(16, "0").slice(0, 16),
    system, flags: { cypherFoundry: { crd: { logicalId, language: lang,
      ...(lang === "fr" ? { sourceLogicalId: logicalId } : {}) } } }
  });
  const skillEn = ability("skill", "en", "skill.charm", "Charm",
    { description: "<p>A positive social interaction.</p>" });
  const skillFr = ability("skill", "fr", "skill.charm", "Charm",
    { description: "<p>A positive social interaction.</p>" });
  const descEn = ability("descriptor", "en", "descriptor.example", "Example",
    { description: "<p>Choose a Skill.</p>", skillOptions: ["Charm"] });
  const descFr = ability("descriptor", "fr", "descriptor.example", "Example",
    { description: "<p>Choose a Skill.</p>", skillOptions: ["Charm"] });
  const rows = [skillEn, skillFr, descEn, descFr].map((document, i) => ({
    pack: ["skills-en", "skills-fr", "descriptors-en", "descriptors-fr"][i],
    file: ["se", "sf", "de", "df"][i],
    logicalId: document.flags.cypherFoundry.crd.logicalId,
    document
  }));
  const proposal = (source, translations, status) => ({
    logicalId: source.flags.cypherFoundry.crd.logicalId,
    sourceLogicalId: source.flags.cypherFoundry.crd.logicalId,
    language: "fr", status,
    fields: [...translationFields(source)].map(([field, text]) => ({
      path: field, text: translations[field] ?? text, sourceHash: sourceHash(text)
    }))
  });
  const proposals = new Map([
    ["skill.charm", { file: "skill.charm.json", proposal: proposal(skillEn, {
      name: "Charme", "system.description": "<p>Une interaction sociale positive.</p>"
    }, "reviewed") }],
    ["descriptor.example", { file: "descriptor.example.json", proposal: proposal(descEn, {
      name: "Exemple", "system.description": "<p>Choisissez une compétence.</p>",
      "system.skillOptions.0": "Charme"
    }, "proposed") }]
  ]);
  const published = materializeTranslations(rows, proposals);
  assert.equal(published.get("sf").name, "Charme");
  assert.equal(published.get("df").name, "Example");
  assert.deepEqual(published.get("df").system.skillOptions, ["Charm"]);
  assert.equal(published.get("df").flags.cypherFoundry.translation.status, "untranslated");
  const preview = materializeTranslations(rows, proposals, { includeProposed: true });
  assert.equal(preview.get("df").name, "Exemple");
  assert.deepEqual(preview.get("df").system.skillOptions, ["Charme"]);
});
