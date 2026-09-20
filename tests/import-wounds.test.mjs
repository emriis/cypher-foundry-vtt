import assert from "node:assert/strict";
import test from "node:test";

import { parseWoundsFromNotes } from "../module/import/wounds.mjs";

test("parseWoundsFromNotes reads each wound severity independently", () => {
  const wounds = parseWoundsFromNotes("<p>Minor: 1/4; Moderate: 2/3; Major: 0/2</p>");

  assert.deepEqual(wounds, {
    minor: { current: 1, max: 4 },
    moderate: { current: 2, max: 3 },
    major: { current: 0, max: 2 }
  });
});

test("parseWoundsFromNotes accepts French labels and preserves independent fallbacks", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  try {
    const wounds = parseWoundsFromNotes("Blessure mineure : 2/5; Blessure majeure : 1/1");

    assert.deepEqual(wounds, {
      minor: { current: 2, max: 5 },
      moderate: { current: 0, max: 3 },
      major: { current: 1, max: 1 }
    });
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test("parseWoundsFromNotes uses defaults for empty notes", () => {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    assert.deepEqual(parseWoundsFromNotes(), {
      minor: { current: 0, max: 3 },
      moderate: { current: 0, max: 3 },
      major: { current: 0, max: 3 }
    });
  } finally {
    console.warn = originalWarn;
  }
});