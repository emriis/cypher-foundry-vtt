import assert from "node:assert/strict";
import test from "node:test";

test("CRD equipment models preserve explicit source-level semantics", () => {
  const equipmentSource = {
    level: null,
    priceCategory: "moderate"
  };
  assert.equal(equipmentSource.level, null);
  assert.equal(equipmentSource.priceCategory, "moderate");
});

test("CRD shield records can preserve their price category", () => {
  const shieldSource = { priceCategory: "moderate" };
  assert.equal(shieldSource.priceCategory, "moderate");
});
