/**
 * PR1 audit fixtures: prove identity mapping without changing source catalogues.
 * Run with node --test tests/content/compendium-identity-audit.test.mjs.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  auditFolderPairs, auditIdentityCatalogue, identitySlug, proposedFoundryId, proposedLogicalId
} from "../../scripts/audit-compendium-identities.mjs";

function record(family, language, logicalId, id, options = {}) {
  const pack = family + "-" + language;
  const kind = options.kind ?? "Item";
  const file = "packs/" + pack + "/_source/" + (options.filename ?? logicalId) + ".json";
  const document = {
    _id: id,
    _key: kind === "Item" ? "!items!" + id : "!journal!" + id,
    document: kind,
    name: options.name ?? logicalId,
    type: options.type ?? (kind === "JournalEntry" ? "journal" : "ability"),
    system: options.system ?? {},
    pages: options.pages,
    flags: { cypherFoundry: { crd: {
      logicalId, language, ...(language === "fr" ? { sourceLogicalId: logicalId } : {})
    } } }
  };
  return { pack, file, logicalId, document };
}

test("Given a canonical English logical ID, proposed Foundry ID is stable and locale-independent", () => {
  const id = "ability.inspiring-defense";
  assert.match(proposedFoundryId(id), /^[a-f0-9]{16}$/);
  assert.equal(proposedFoundryId(id), proposedFoundryId(id));
  assert.notEqual(proposedFoundryId(id), proposedFoundryId("ability.agile-wit"));
  assert.throws(() => proposedFoundryId(""), /empty/);
});

test("Given a grandfathered equipment ID, proposal retains genre, price and source name components", () => {
  assert.equal(proposedLogicalId("equipment.Fantasy.inexpensive.Arrows (12)"),
    "equipment.fantasy.inexpensive.arrows-12");
  assert.equal(identitySlug("Épée à deux mains"), "epee-a-deux-mains");
  assert.throws(() => proposedLogicalId(""), /Missing canonical/);
  assert.throws(() => proposedLogicalId("equipment..broken"), /Cannot normalize/);
});

test("Given different EN/FR legacy IDs, the report maps both to one proposed _id", () => {
  const logical = "type.barbarian";
  const en = record("types", "en", logical, "cBy4vHd3CHyNjLF7", { type: "type" });
  const fr = record("types", "fr", logical, "imqmlZfGMjn0RKrF", { type: "type" });
  const report = auditIdentityCatalogue([en, fr], [en, fr]);
  const pair = report.entries[0];
  assert.equal(pair.en.proposedId, pair.fr.proposedId);
  assert.notEqual(pair.en.currentId, pair.fr.currentId);
  assert.equal(pair.en.authoringId, en.document._id);
  assert.equal(report.summary.types.differingCurrentIds, 1);
  assert.equal(pair.en.proposedUuid, "Compendium.cypher.types-en.Item." + pair.en.proposedId);
  assert.equal(pair.fr.proposedUuid, "Compendium.cypher.types-fr.Item." + pair.fr.proposedId);
  assert.equal(report.issueCounts.missingCounterparts, 0);
});

test("Given a Focus with English/French Ability references, both UUIDs and edges are audited", () => {
  const enAbility = record("abilities", "en", "ability.shield", "1111111111111111");
  const frAbility = record("abilities", "fr", "ability.shield", "2222222222222222");
  const enUuid = "Compendium.cypher.abilities-en.Item.1111111111111111";
  const frUuid = "Compendium.cypher.abilities-fr.Item.2222222222222222";
  const enFocus = record("foci", "en", "focus.guards", "3333333333333333", {
    type: "focus", system: {
      abilities: [enUuid],
      flowchart: { edges: [{ from: "1111111111111111", to: "1111111111111111" }] }
    }
  });
  const frFocus = record("foci", "fr", "focus.guards", "3333333333333333", {
    type: "focus", system: {
      abilities: [frUuid],
      flowchart: { edges: [{ from: "2222222222222222", to: "2222222222222222" }] }
    }
  });
  const report = auditIdentityCatalogue([enAbility, frAbility, enFocus, frFocus]);
  assert.equal(report.issueCounts.danglingUuidReferences, 0);
  assert.equal(report.issueCounts.danglingFocusEdges, 0);
  assert.equal(report.references.length, 2);
  const refs = report.references.map(ref => ref.proposedUuid);
  assert.ok(refs.includes("Compendium.cypher.abilities-en.Item." + proposedFoundryId("ability.shield")));
  assert.ok(refs.includes("Compendium.cypher.abilities-fr.Item." + proposedFoundryId("ability.shield")));
});

test("Given Journal pages in both packs, proposed page IDs share the English page anchor", () => {
  const en = record("rules", "en", "journal.task-difficulty", "4444444444444444", {
    kind: "JournalEntry", pages: [{ _id: "aaaaaaaaaaaaaaaa", _key: "!journal.pages!x.aaaaaaaaaaaaaaaa" }]
  });
  const fr = record("rules", "fr", "journal.task-difficulty", "5555555555555555", {
    kind: "JournalEntry", pages: [{ _id: "bbbbbbbbbbbbbbbb", _key: "!journal.pages!y.bbbbbbbbbbbbbbbb" }]
  });
  const report = auditIdentityCatalogue([en, fr]);
  assert.equal(report.entries[0].en.pages[0].proposedId, report.entries[0].fr.pages[0].proposedId);
  assert.equal(report.issueCounts.journalPageMismatches, 0);
  assert.equal(report.entries[0].en.proposedKey, "!journal!" + proposedFoundryId("journal.task-difficulty"));
});

test("Given a missing counterpart, slug collision and unresolved links, the audit reports them without guessing", () => {
  const one = record("equipment", "en", "equipment.Fantasy.Arrows (12)", "6666666666666666", {
    type: "equipment", system: { abilities: ["Compendium.cypher.abilities-en.Item.ffffffffffffffff"] }
  });
  const two = record("equipment", "en", "equipment.fantasy.arrows-12", "7777777777777777", {
    type: "equipment"
  });
  const report = auditIdentityCatalogue([one, two]);
  assert.equal(report.issueCounts.missingCounterparts, 2);
  assert.equal(report.issueCounts.logicalSlugCollisions, 1);
  assert.equal(report.issueCounts.proposedIdCollisions, 1);
  assert.equal(report.issueCounts.danglingUuidReferences, 1);
});

test("Given duplicate logical ownership and mismatched Journal pages, defects remain explicit", () => {
  const en = record("rules", "en", "journal.test", "8888888888888888", {
    kind: "JournalEntry", pages: [{ _id: "9999999999999999" }]
  });
  const fr = record("rules", "fr", "journal.test", "aaaaaaaaaaaaaaaa", {
    kind: "JournalEntry", pages: []
  });
  const duplicate = record("rules", "en", "journal.test", "bbbbbbbbbbbbbbbb", {
    kind: "JournalEntry", filename: "other"
  });
  const report = auditIdentityCatalogue([en, fr, duplicate]);
  assert.equal(report.issueCounts.duplicateLogicalIds, 1);
  assert.equal(report.issueCounts.journalPageMismatches, 1);
});

test("Given English and French Folder names, mapping uses the stable source path, not the translation", () => {
  const rows = [
    { pack: "descriptors-en", file: "packs/descriptors-en/_source/folder-general.json",
      document: { _id: "dscGeneralEn0001", _key: "!folders!dscGeneralEn0001", name: "General Descriptors" } },
    { pack: "descriptors-fr", file: "packs/descriptors-fr/_source/folder-general.json",
      document: { _id: "dscGeneralFr0001", _key: "!folders!dscGeneralFr0001", name: "Descripteurs généraux" } }
  ];
  const report = auditFolderPairs(rows);
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].en.proposedId, report.entries[0].fr.proposedId);
  assert.equal(report.entries[0].en.proposedKey, "!folders!" + report.entries[0].en.proposedId);
  assert.equal(report.issues.missingPairs.length, 0);
});

test("Given an unpaired Folder and unknown parent, audit does not assume the relationship", () => {
  const report = auditFolderPairs([{
    pack: "equipment-en", file: "packs/equipment-en/_source/equipment-folder.json",
    document: { _id: "EqEnRootFolder01", name: "Equipment", folder: "unknown-parent" }
  }]);
  assert.equal(report.issues.missingPairs.length, 1);
  assert.equal(report.issues.danglingFolderReferences.length, 1);
});
