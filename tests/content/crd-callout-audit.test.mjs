import assert from "node:assert/strict";
import test from "node:test";
import { locateCallout, validateFocusCallouts, validateAdjudications } from "../../scripts/audit-crd-callouts.mjs";

const fields = [
  { file: "packs/foci-en/_source/example.json", logicalId: "focus.example",
    field: "system.description", text: "<p>GM intrusions: The sky burns with strange fire.</p>" },
  { file: "packs/rules-en/_source/example.json", logicalId: "journal.example",
    field: "pages.0.text.content", text: "<p>Example: One character assists another character.</p>" }
];

test("full Word callout paragraph must be present to claim a verbatim English pack match", () => {
  const candidate = { paragraph: 123, text: "GM intrusions: The sky burns with strange fire." };
  const result = locateCallout(candidate, fields, []);
  assert.equal(result.status, "verbatim-in-english-pack");
  assert.equal(result.matches[0].logicalId, "focus.example");
  assert.equal(result.matches[0].field, "system.description");
});

test("a short heading alone is never proof of whole callout coverage", () => {
  const result = locateCallout({ paragraph: 10, text: "GM intrusions:" },
    [{ file: "some.json", field: "name", text: "GM intrusions:" }], []);
  assert.equal(result.status, "no-proven-pack-coverage");
  assert.deepEqual(result.matches, []);
});

test("source locator alone is not a proof that the complete text is retained", () => {
  const contracts = [{ file: "packs/abilities-en/_source/fragment.json",
    field: "system.description", scope: "exact-fragment", source: { start: 5, end: 12 } }];
  const result = locateCallout({ paragraph: 8, text: "The blue moon appears overhead." },
    fields, contracts);
  assert.equal(result.status, "locator-only-review-required");
  assert.equal(result.locatorClaims.length, 1);
});

test("explicit editorial exclusion must be reviewed for a separate destination", () => {
  const contracts = [{ file: "packs/abilities-en/_source/excluded.json",
    field: "system.description", scope: "editorial-excluded-from-normalized-packs",
    source: { start: 42, end: 46 } }];
  const result = locateCallout({ paragraph: 44, text: "An unexpected revelation changes the story." },
    [], contracts);
  assert.equal(result.status, "editorial-exclusion-needs-destination");
});

test("absent passages are never silently treated as verified", () => {
  const result = locateCallout({ paragraph: 999, text: "The GM may alter the condition." },
    fields, []);
  assert.equal(result.status, "no-proven-pack-coverage");
});

test("all canonical Focus sidebars must be matched in their entirety", () => {
  const candidates = [
    { paragraph: 1, kind: "genre-themes", section: "Foci / Understanding Your Focus / Example",
      coverage: { status: "verbatim-in-english-pack" } },
    { paragraph: 2, kind: "gm-intrusion", section: "Foci / Understanding Your Focus / Example",
      coverage: { status: "verbatim-in-english-pack" } }
  ];
  assert.deepEqual(validateFocusCallouts(candidates, 1), []);
  candidates[1].coverage.status = "no-proven-pack-coverage";
  assert.match(validateFocusCallouts(candidates, 1).join("\n"), /Unrepresented Focus gm-intrusion/);
  assert.match(validateFocusCallouts(candidates, 2).join("\n"), /Expected 2 Focus/);
});

test("editorial deferrals must match the exact CRD and cannot disguise a represented passage", () => {
  const candidate = { paragraph: 9, kind: "gm-intrusion", section: "Equipment / Special Rules",
    coverage: { status: "no-proven-pack-coverage" } };
  const registry = { referenceSha256: "abc",
    decisions: [{ paragraph: 9, kind: "gm-intrusion", sectionPrefix: "Equipment",
      status: "deferred-full-crd-journal", reason: "General rule.", target: "Equipment Journal" }] };
  assert.equal(validateAdjudications([candidate], registry, "abc").size, 1);
  assert.throws(() => validateAdjudications([candidate], registry, "changed"), /different source revision/);
  candidate.coverage.status = "verbatim-in-english-pack";
  assert.throws(() => validateAdjudications([candidate], registry, "abc"), /Already-covered/);
});
