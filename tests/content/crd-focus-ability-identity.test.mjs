import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const FOCUS_SLUGS = [
  "abides-in-stone", "blazes-with-fire", "builds-allies", "carries-a-gun",
  "casts-spells", "changes-shape", "commands-mental-powers",
  "consorts-with-the-dead", "controls-beasts", "crafts-illusions",
  "doesnt-do-much", "employs-magnetism", "entertains", "explores",
  "fights-dirty", "fights-unarmed", "fights-with-panache",
  "fuses-flesh-and-steel", "fuses-mind-and-machine",
  "grows-to-towering-heights", "howls-at-the-moon", "hunts", "infiltrates",
  "leads", "masters-telekinesis", "masters-weaponry",
  "moves-like-the-wind", "never-says-die", "performs-feats-of-strength",
  "quells-evil", "reveres-a-supernatural-force", "rides-the-lightning",
  "sneaks-through-the-shadows", "solves-mysteries", "speaks-for-the-land",
  "stands-like-a-bastion", "strikes-with-mystic-might",
  "talks-to-machines", "tends-to-the-wounded", "walks-through-walls",
  "wears-a-sheen-of-ice", "works-for-a-living"
];

function readSources(family, language) {
  const directory = path.join(root, "packs", family + "-" + language, "_source");
  return fs.readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")))
    .filter(document => !document._key?.startsWith("!folders!"));
}

function abilityId(reference) {
  return typeof reference === "string"
    ? reference.match(/Item\.([A-Za-z0-9]{16})$/)?.[1] ?? null
    : null;
}

function abilityMap(language) {
  return new Map(readSources("abilities", language).map(document => [
    document._id, document
  ]));
}

function logicalAbility(document) {
  return document?.system?.key ?? null;
}

function normalizeEdges(focus, abilities) {
  return (focus.system.flowchart?.edges ?? []).map(edge => {
    return logicalAbility(abilities.get(edge.from)) + "->" +
      logicalAbility(abilities.get(edge.to));
  }).sort();
}

test("CRD Foci use the same Ability logical identities in EN and FR", () => {
  const enFoci = new Map();
  const frFoci = new Map();
  for (const slug of FOCUS_SLUGS) {
    for (const language of ["en", "fr"]) {
      const file = path.join(
        root, "packs", "foci-" + language, "_source", slug + ".json"
      );
      const document = JSON.parse(fs.readFileSync(file, "utf8"));
      (language === "en" ? enFoci : frFoci).set(slug, document);
    }
  }
  const enAbilities = abilityMap("en");
  const frAbilities = abilityMap("fr");
  const failures = [];

  for (const slug of FOCUS_SLUGS) {
    const en = enFoci.get(slug);
    const fr = frFoci.get(slug);

    if (!en || !fr) {
      failures.push(slug + ": missing EN or FR Focus source");
      continue;
    }

    const enIds = (en.system.abilities ?? []).map(abilityId);
    const frIds = (fr.system.abilities ?? []).map(abilityId);
    const enKeys = enIds.map(id => logicalAbility(enAbilities.get(id)));
    const frKeys = frIds.map(id => logicalAbility(frAbilities.get(id)));

    if (enIds.some(id => !id) || frIds.some(id => !id) ||
        enKeys.some(key => !key) || frKeys.some(key => !key)) {
      failures.push(slug + ": malformed or unresolved Ability reference");
      continue;
    }

    if (JSON.stringify([...enKeys].sort()) !==
        JSON.stringify([...frKeys].sort())) {
      failures.push(slug + ": EN/FR Ability identity mismatch");
    }

    const enEdges = normalizeEdges(en, enAbilities);
    const frEdges = normalizeEdges(fr, frAbilities);
    if (JSON.stringify(enEdges) !== JSON.stringify(frEdges)) {
      failures.push(slug + ": EN/FR flowchart identity mismatch");
    }

    const graphed = new Set(enEdges.flatMap(edge => edge.split("->")));
    const missing = [...new Set(enKeys)].filter(key => !graphed.has(key));
    if (missing.length > 0) {
      failures.push(slug + ": Ability(s) missing from flowchart: " +
        missing.sort().join(", "));
    }
  }

  assert.deepEqual(failures, [], "Focus Ability identity audit failures");
});
