import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCrdLogicalId,
  buildCrdReferenceTarget,
  getCrdPairingKey,
  isValidCrdLogicalId,
  normalizeCrdIdComponent
} from "../../module/crd/identifiers.mjs";

test("normalizes source names deterministically", () => {
  assert.equal(
    normalizeCrdIdComponent("Fuses Flesh & Steel"),
    "fuses-flesh-steel"
  );
  assert.equal(
    normalizeCrdIdComponent("L'éclaireur"),
    "leclaireur"
  );
});

test("builds language-neutral logical IDs", () => {
  assert.equal(
    buildCrdLogicalId("ability", "Wounded Fury"),
    "ability.wounded-fury"
  );
  assert.ok(isValidCrdLogicalId("focus.howls-at-the-moon"));
});

test("logical IDs are pairing keys and are not localized", () => {
  const id = buildCrdLogicalId("descriptor", "Resilient");
  assert.equal(getCrdPairingKey(id), "descriptor.resilient");
  assert.equal(buildCrdReferenceTarget(id).logicalId, id);
});

test("invalid logical IDs are rejected", () => {
  assert.equal(isValidCrdLogicalId("Wounded Fury"), false);
  assert.equal(isValidCrdLogicalId("ability/Wounded Fury"), false);
  assert.throws(
    () => getCrdPairingKey("ability"),
    /Invalid CRD logical ID/
  );
});
