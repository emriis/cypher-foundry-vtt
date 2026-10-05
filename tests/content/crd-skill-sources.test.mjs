import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateCrdSourceRecord } from "../../module/crd/source-schema.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const languages = ["en", "fr"];
const expectedCount = 58;

function readSkills(language) {
  const directory = path.join(root, "packs", `skills-${language}`, "_source");
  return fs.readdirSync(directory)
    .filter(file => file.endsWith(".json"))
    .sort()
    .map(file => JSON.parse(
      fs.readFileSync(path.join(directory, file), "utf8")
    ));
}

test("CRD skill source packs contain the complete Master Skill List", () => {
  const records = Object.fromEntries(
    languages.map(language => [language, readSkills(language)])
  );

  for (const language of languages) {
    assert.equal(records[language].length, expectedCount, language);
    for (const record of records[language]) {
      assert.deepEqual(validateCrdSourceRecord(record), [], record.name);
      assert.equal(record.document, "Item");
      assert.equal(record.type, "skill");
      assert.equal(record.crdType, "skill");
      assert.equal(record.system.stat, "none");
      assert.equal(record.system.level, "trained");
      assert.equal(record.system.attackCategory, "");
      assert.match(record.system.description, /<p>.+<\\/p>/);
    }
  }
});

test("English and French CRD skill records are paired by logical ID", () => {
  const en = readSkills("en");
  const fr = readSkills("fr");
  const enById = new Map(
    en.map(record => [record.flags.cypherFoundry.crd.logicalId, record])
  );
  const frById = new Map(
    fr.map(record => [record.flags.cypherFoundry.crd.logicalId, record])
  );

  assert.equal(enById.size, expectedCount);
  assert.equal(frById.size, expectedCount);

  for (const [logicalId, english] of enById) {
    const french = frById.get(logicalId);
    assert.ok(french, logicalId);
    assert.equal(
      french.flags.cypherFoundry.crd.sourceLogicalId,
      english.flags.cypherFoundry.crd.logicalId
    );
    assert.deepEqual(
      french.system,
      english.system,
      logicalId
    );
  }
});

test("CRD tier-restricted skills preserve training and specialization boundaries", () => {
  const skills = readSkills("en");
  const restricted = new Map(
    skills
      .filter(record => record.system.minimumTier !== null)
      .map(record => [
        record.flags.cypherFoundry.crd.logicalId,
        record.system.minimumTier,
        record.system.minimumSpecializationTier
      ])
  );

  assert.deepEqual(
    [...restricted.entries()].sort(),
    [
      ["skill.attacking", 2, 4],
      ["skill.defending", 2, 4],
      ["skill.gunnery", 2, 4]
    ]
  );
});
