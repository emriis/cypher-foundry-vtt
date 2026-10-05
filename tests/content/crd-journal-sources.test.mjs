import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateCrdSourceRecord } from "../../module/crd/source-schema.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const id = "a1b2c3d4e5f60708";

function read(language) {
  return JSON.parse(
    fs.readFileSync(
      path.join(root, "packs", `rules-${language}`, "_source", `${id}.json`),
      "utf8"
    )
  );
}

test("Task Difficulty CRD journal sources satisfy the source contract", () => {
  for (const language of ["en", "fr"]) {
    const record = read(language);
    assert.deepEqual(validateCrdSourceRecord(record), []);
    assert.equal(record.document, "JournalEntry");
    assert.equal(record.crdType, "journal");
    assert.equal(record._key, `!journal!${id}`);
    assert.equal(record.flags.cypherFoundry.crd.logicalId, "journal.task-difficulty");
    assert.equal(record.flags.cypherFoundry.crd.language, language);
  }
});

test("English and French Task Difficulty sources preserve the same mechanics", () => {
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
