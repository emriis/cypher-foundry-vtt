import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getCrdLogicalId,
  validateCrdSourceRecord
} from "../../module/crd/source-schema.mjs";

const root = path.resolve(import.meta.dirname, "../..");

const CONTENT_PACKS = [
  ["skills", "skill"],
  ["abilities", "ability"],
  ["types", "type"],
  ["foci", "focus"],
  ["descriptors", "descriptor"]
];

function readSources(family, language) {
  const directory = path.join(
    root,
    "packs",
    `${family}-${language}`,
    "_source"
  );

  return fs.readdirSync(directory, { recursive: true })
    .filter(file => file.endsWith(".json"))
    .map(file => ({
      file,
      document: JSON.parse(
        fs.readFileSync(path.join(directory, file), "utf8")
      )
    }))
    .filter(({ document }) => !document._key?.startsWith("!folders!"));
}

for (const [family, crdType] of CONTENT_PACKS) {
  for (const language of ["en", "fr"]) {
    test(`${family}-${language} source records satisfy the common CRD contract`, () => {
      const records = readSources(family, language);
      assert.ok(records.length > 0, family);

      const logicalIds = new Set();

      for (const { file, document } of records) {
        assert.equal(document.document, "Item", file);
        assert.equal(document.crdType, crdType, file);
        assert.deepEqual(validateCrdSourceRecord(document), [], file);

        const provenance = document.flags.cypherFoundry.crd;
        assert.ok(!logicalIds.has(provenance.logicalId), provenance.logicalId);
        logicalIds.add(provenance.logicalId);

        assert.equal(provenance.language, language, file);
        assert.equal(provenance.version, "2026-07-29", file);
        assert.equal(provenance.sourceKind, "record", file);
        assert.ok(provenance.section, file);
        assert.ok(provenance.sourceLocator, file);
        assert.ok(Array.isArray(provenance.transformations), file);

        if (language === "fr") {
          assert.equal(
            typeof provenance.sourceLogicalId,
            "string",
            file
          );
        }
      }
    });
  }

  test(`${family} English and French sources preserve logical identity`, () => {
    const en = new Map(
      readSources(family, "en").map(({ file, document }) => [
        file,
        document
      ])
    );
    const fr = new Map(
      readSources(family, "fr").map(({ file, document }) => [
        file,
        document
      ])
    );

    assert.deepEqual([...fr.keys()].sort(), [...en.keys()].sort());

    for (const [file, english] of en) {
      const french = fr.get(file);
      assert.ok(french, file);

      const englishId = getCrdLogicalId(english);
      const frenchProvenance = french.flags.cypherFoundry.crd;

      assert.equal(frenchProvenance.sourceLogicalId, englishId, file);
      assert.equal(frenchProvenance.logicalId, englishId, file);
    }
  });
}
