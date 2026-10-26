import assert from "node:assert/strict";
import test from "node:test";
import { auditAutomation } from "../../scripts/crd-audit/automation.mjs";

test("cutting automation audit identifies executable object handling and preserves adjudication limits", () => {
  const report = auditAutomation({ type: "attack", system: { mechanics: { cutsThroughMaterialsLevel: 6 } } });
  assert.ok(report.implemented.some(entry => entry.includes("object-service")));
  assert.ok(report.gaps.some(entry => entry.includes("compatibility is explicitly adjudicated")));
  assert.ok(!report.gaps.some(entry => entry.includes("object/material level state missing")));
  assert.equal(report.status, "partial-or-adjudicated");
});
