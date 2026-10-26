/** CRD Resource Points, paragraphs 8134–8164: costs and qualification boundaries. */
import assert from "node:assert/strict";
import test from "node:test";
import { quoteProject } from "../../module/rules/projects.mjs";

test("manifest cypher crafting uses power classification and the exact training/cost table", () => {
  for (const [power, training, cost] of [["low", 1, 2], ["medium", 2, 3], ["advanced", 3, 4]]) {
    assert.deepEqual(quoteProject({ kind: "craftCypher", power, training }), { cost, minimumTraining: training });
    assert.equal(quoteProject({ kind: "craftCypher", power, training: training - 1 }), null);
  }
  for (const power of ["", "high", "ultra"]) assert.equal(quoteProject({ kind: "craftCypher", power, training: 3 }), null);
});

test("ordinary crafting and repair require appropriate training and a level no higher than four", () => {
  for (const kind of ["craftObject", "repairObject"]) {
    assert.deepEqual(quoteProject({ kind, level: 4, training: 1 }), { cost: 1, minimumTraining: 1 });
    assert.equal(quoteProject({ kind, level: 4, training: 0 }), null);
    assert.equal(quoteProject({ kind, level: 5, training: 3 }), null);
  }
  assert.deepEqual(quoteProject({ kind: "craftArtifact", level: 5, training: 2 }), { cost: 5, minimumTraining: 2 });
  assert.equal(quoteProject({ kind: "craftArtifact", level: 6, training: 3 }), null);
});

test("contacts and research use the CRD levels and cannot buy an above-seven result", () => {
  for (const [level, cost] of [[3, 1], [5, 2], [7, 3]]) {
    assert.deepEqual(quoteProject({ kind: "contact", level }), { cost, minimumTraining: 0 });
  }
  assert.equal(quoteProject({ kind: "contact", level: 4 }), null);
  for (let level = 1; level <= 7; level++) {
    assert.deepEqual(quoteProject({ kind: "research", level }), { cost: level <= 3 ? 1 : level <= 5 ? 2 : 3, minimumTraining: 0 });
  }
  assert.equal(quoteProject({ kind: "research", level: 8 }), null);
});

test("invalid numeric inputs and unknown activities never produce a payable quote", () => {
  for (const level of [-1, 0, 1.5, NaN, Infinity]) assert.equal(quoteProject({ kind: "craftObject", level, training: 3 }), null);
  assert.equal(quoteProject({ kind: "craftObject", level: 2, training: 4 }), null);
  assert.equal(quoteProject({ kind: "unknown", level: 1 }), null);
});

test("restoration rounds half-level upward; friendship penalties double the later cost", () => {
  assert.equal(quoteProject({ kind: "restoreFollower", level: 3 }).cost, 2);
  assert.equal(quoteProject({ kind: "restoreFollower", level: 1 }).cost, 1);
  assert.equal(quoteProject({ kind: "befriend", level: 3 }).cost, 6);
  assert.equal(quoteProject({ kind: "befriend", level: 3, befriendPenalty: true }).cost, 12);
  assert.equal(quoteProject({ kind: "befriend", level: 8 }), null);
});

test("higher-level or higher-technology crafting needs specialization and an explicit GM cost", () => {
  assert.equal(quoteProject({ kind: "craftObject", level: 6, training: 3 }), null);
  assert.equal(quoteProject({ kind: "craftObject", level: 6, training: 3, customCost: 1 }), null);
  assert.equal(quoteProject({ kind: "craftObject", level: 2, advancedTechnology: true, training: 1, customCost: 3 }), null);
  assert.equal(quoteProject({ kind: "craftObject", level: 6, training: 2, customCost: 3 }).cost, 3);
  assert.equal(quoteProject({ kind: "craftArtifact", level: 4, training: 3, customCost: 4 }), null);
  assert.equal(quoteProject({ kind: "rest" }).cost, 0);
  assert.equal(quoteProject({ kind: "carouse" }).cost, 0);
});
