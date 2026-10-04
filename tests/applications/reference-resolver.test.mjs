import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDocumentReference,
  resolveDocumentReferences
} from "../../module/applications/reference-resolver.mjs";

test("resolveDocumentReference resolves and validates a document type", async () => {
  const ability = { type: "ability", id: "ability-1" };
  globalThis.fromUuid = async uuid => uuid === "valid" ? ability : null;

  assert.equal(
    await resolveDocumentReference("valid", "ability"),
    ability
  );
  assert.equal(
    await resolveDocumentReference("valid", "focus"),
    null
  );
});

test("resolveDocumentReference accepts an already resolved document", async () => {
  const ability = { type: "ability", id: "ability-1" };

  assert.equal(
    await resolveDocumentReference(ability, "ability"),
    ability
  );
});

test("resolveDocumentReferences filters missing and wrong-type references", async () => {
  const documents = {
    first: { type: "ability", id: "first" },
    second: { type: "focus", id: "second" }
  };
  globalThis.fromUuid = async uuid => documents[uuid] ?? null;

  assert.deepEqual(
    await resolveDocumentReferences(
      ["first", "missing", "second"],
      "ability"
    ),
    [documents.first]
  );
});
