import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readPackSourceMap, readPackSources } from "../helpers/canonical-sources.mjs";

import { validateCrdSourceRecord } from "../../module/crd/source-schema.mjs";
import { proposedFoundryId } from "../../scripts/source-migration/id-contract.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const id = "a1b2c3d4e5f60708";

function read(language) {
  return readPackSourceMap(root, `rules-${language}`).get(id + ".json");
}

test("Task Difficulty CRD journal sources satisfy the source contract", () => {
  for (const language of ["en", "fr"]) {
    const record = read(language);
    assert.deepEqual(validateCrdSourceRecord(record), []);
    assert.equal(record.document, "JournalEntry");
    assert.equal(record.crdType, "journal");
    assert.equal(record._key, `!journal!${proposedFoundryId("journal.task-difficulty")}`);
    assert.equal(record.flags.cypherFoundry.crd.logicalId, "journal.task-difficulty");
    assert.equal(record.flags.cypherFoundry.crd.language, language);
  }
});

test("English and French Task Difficulty sources preserve the same markup structure", () => {
  const en = read("en");
  const fr = read("fr");

  const normalize = record => ({
    document: record.document,
    crdType: record.crdType,
    logicalId: record.flags.cypherFoundry.crd.logicalId,
    pageCount: record.pages.length,
    content: record.pages.map(page => page.text.content.replace(/>[^<]+</g, "><"))
  });

  assert.deepEqual(normalize(fr), normalize(en));
  assert.equal(
    fr.flags.cypherFoundry.crd.sourceLogicalId,
    en.flags.cypherFoundry.crd.logicalId
  );
});
