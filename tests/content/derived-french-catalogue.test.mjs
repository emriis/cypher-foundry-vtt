import assert from "node:assert/strict";
import test from "node:test";
import { deriveFrenchCatalogue, frenchReference } from "../../scripts/localization/derive-french-catalogue.mjs";

test("French document derives canonical IDs, rule mechanics and cross-pack links from English", () => {
  const id = "abcdef0123456789";
  const source = {
    _id: id, _key: "!items!" + id, name: "English",
    type: "focus", document: "Item",
    system: { description: "Canonical source text", cost: { amount: 2 },
      abilities: ["Compendium.cypher.abilities-en.Item." + id] },
    flags: { cypherFoundry: { crd: { logicalId: "focus.example",
      language: "en", sourceLocator: "CRD — Focus: Example" } } }
  };
  const en = [{ pack: "foci-en", file: "packs/foci-en/_source/example.json",
    document: source, logicalId: "focus.example" }];
  const [fr] = deriveFrenchCatalogue(en);
  assert.equal(fr.document._id, source._id);
  assert.equal(fr.document.system.cost.amount, 2);
  assert.equal(fr.document.system.description, source.system.description);
  assert.equal(fr.document.system.abilities[0],
    "Compendium.cypher.abilities-fr.Item." + id);
  assert.equal(fr.document.flags.cypherFoundry.crd.sourceLogicalId, "focus.example");
  assert.equal(fr.document.flags.cypherFoundry.crd.language, "fr");
  assert.equal(fr.document.flags.cypherFoundry.crd.sourceLocator, source.flags.cypherFoundry.crd.sourceLocator);
  assert.equal(source.flags.cypherFoundry.crd.language, "en", "Do not mutate canonical English data");
  assert.equal(frenchReference("Compendium.external.abilities-en.Item." + id),
    "Compendium.external.abilities-en.Item." + id);
});
