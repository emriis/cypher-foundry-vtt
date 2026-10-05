import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getCrdLogicalId,
  validateCrdSourceRecord
} from "../../module/crd/source-schema.mjs";

const root = path.resolve(import.meta.dirname, "../..");

const STANDARD_DESCRIPTORS = [
  "appealing",
  "bookish",
  "brash",
  "calm",
  "cautious",
  "chaotic",
  "charming",
  "clever",
  "compassionate",
  "creative",
  "empathic",
  "fast",
  "gloomy",
  "graceful",
  "guarded",
  "honorable",
  "inquisitive",
  "intelligent",
  "intuitive",
  "jovial",
  "kind",
  "mechanical",
  "mysterious",
  "mystical",
  "perceptive",
  "resilient",
  "rugged",
  "skeptical",
  "stealthy",
  "strong",
  "strong-willed",
  "tough",
  "virtuous"
];

const SPECIES_DESCRIPTORS = [
  "aarak",
  "cyborg",
  "d-nec",
  "delph",
  "dragonfolk",
  "drakain",
  "dwarf",
  "elf",
  "gnome",
  "halfling",
  "hellborn",
  "human",
  "mutant",
  "naron",
  "orc",
  "prota",
  "rigellian",
  "stela(n)"
].map(value => value === "stela(n)" ? "stelan" : value).sort();

function readSources(language, category) {
  const directory = path.join(
    root,
    "packs",
    `descriptors-${language}`,
    "_source",
    category
  );

  return new Map(
    fs.readdirSync(directory)
      .filter(file => file.endsWith(".json"))
      .map(file => [
        path.basename(file, ".json"),
        JSON.parse(
          fs.readFileSync(path.join(directory, file), "utf8")
        )
      ])
  );
}

test("CRD Descriptor inventory is complete in both languages", () => {
  for (const language of ["en", "fr"]) {
    assert.deepEqual(
      [...readSources(language, "standard").keys()].sort(),
      STANDARD_DESCRIPTORS
    );
    assert.deepEqual(
      [...readSources(language, "species").keys()].sort(),
      SPECIES_DESCRIPTORS
    );
  }
});

for (const language of ["en", "fr"]) {
  test(`${language} Descriptor sources satisfy the CRD source contract`, () => {
    const logicalIds = new Set();

    for (const category of ["standard", "species"]) {
      for (const [filename, document] of readSources(language, category)) {
        assert.equal(document.document, "Item", filename);
        assert.equal(document.crdType, "descriptor", filename);
        assert.equal(document.type, "descriptor", filename);
        assert.deepEqual(
          validateCrdSourceRecord(document),
          [],
          filename
        );

        const provenance = document.flags?.cypherFoundry?.crd;
        assert.ok(provenance, filename);
        assert.equal(provenance.version, "2026-07-29", filename);
        assert.equal(provenance.language, language, filename);
        assert.equal(provenance.sourceKind, "record", filename);
        assert.ok(provenance.section, filename);
        assert.ok(provenance.sourceLocator, filename);
        assert.ok(Array.isArray(provenance.transformations), filename);

        const expectedPrefix = category === "species"
          ? "descriptor.species."
          : "descriptor.";
        assert.match(
          provenance.logicalId,
          new RegExp(`^${expectedPrefix}[a-z0-9-]+$`),
          filename
        );
        assert.ok(
          !logicalIds.has(provenance.logicalId),
          provenance.logicalId
        );
        logicalIds.add(provenance.logicalId);

        if (language === "fr") {
          assert.equal(
            provenance.sourceLogicalId,
            provenance.logicalId,
            filename
          );
        }
      }
    }

    assert.equal(logicalIds.size, 53);
  });
}

test("English and French Descriptor sources preserve logical identity and mechanics", () => {
  const en = new Map([
    ...readSources("en", "standard"),
    ...readSources("en", "species")
  ]);
  const fr = new Map([
    ...readSources("fr", "standard"),
    ...readSources("fr", "species")
  ]);

  assert.deepEqual([...fr.keys()].sort(), [...en.keys()].sort());

  for (const [filename, english] of en) {
    const french = fr.get(filename);
    assert.ok(french, filename);

    assert.equal(
      french.flags.cypherFoundry.crd.sourceLogicalId,
      english.flags.cypherFoundry.crd.logicalId,
      filename
    );

    assert.equal(
      french.system.category ?? "descriptor",
      english.system.category ?? "descriptor",
      filename
    );
    assert.deepEqual(
      french.system.genres ?? [],
      english.system.genres ?? [],
      filename
    );
    assert.equal(
      french.system.grantsSecondDescriptor ?? false,
      english.system.grantsSecondDescriptor ?? false,
      filename
    );
    assert.deepEqual(
      french.system.statOptions ?? [],
      english.system.statOptions ?? [],
      filename
    );
    assert.equal(
      french.system.statAmount,
      english.system.statAmount,
      filename
    );
    assert.equal(
      (french.system.skillOptions ?? []).length,
      (english.system.skillOptions ?? []).length,
      filename
    );
    assert.equal(
      (french.system.grantedSkills ?? []).length,
      (english.system.grantedSkills ?? []).length,
      filename
    );
    assert.equal(
      (french.system.benefits ?? []).length,
      (english.system.benefits ?? []).length,
      filename
    );
  }
});

test("Descriptor benefits remain structured and do not become standalone Abilities", () => {
  for (const language of ["en", "fr"]) {
    for (const category of ["standard", "species"]) {
      for (const [filename, document] of readSources(language, category)) {
        for (const benefit of document.system.benefits ?? []) {
          assert.equal(typeof benefit.name, "string", filename);
          assert.ok(benefit.name.trim(), filename);
          assert.equal(typeof benefit.description, "string", filename);
          assert.ok(benefit.description.trim(), filename);
        }
      }
    }
  }
});
