import assert from "node:assert/strict";
import test from "node:test";
import { isCarriedCypher, cypherCapacity, resolveCypherGeneration } from "../../module/rules/cyphers.mjs";
const cypher = (custody, depleted = false) => ({ type: "cypher", system: { depleted }, flags: { cypher: { custody } } });

test("only live carried cyphers use capacity, including unresolved transfers conservatively", () => {
  const items = [cypher(), cypher("carried"), cypher("stashed"), cypher("discarded"), cypher("transferred"), cypher("carried", true)];
  assert.equal(items.filter(isCarriedCypher).length, 2);
  assert.equal(cypherCapacity(items, 2), false); assert.equal(cypherCapacity(items, 3), true);
  assert.equal(isCarriedCypher(cypher("transferring")), true);
  assert.equal(isCarriedCypher({ type: "equipment", system: {} }), false);
});

test("the manifest power table preserves each CRD boundary", () => {
  for (const [roll, power] of [[1, "low"], [45, "low"], [46, "medium"], [80, "medium"], [81, "advanced"], [92, "advanced"],
    [93, "high"], [98, "high"], [99, "ultra"], [100, "ultra"]]) assert.equal(resolveCypherGeneration("manifest", roll).power, power);
});

test("superhero 37–100 redirects to Random Cyphers and cannot invent a tenth boost", () => {
  assert.equal(resolveCypherGeneration("superhero", 36).logicalId, "cypher.power-boost.split-boost");
  assert.equal(resolveCypherGeneration("superhero", 37).redirect, "subtle");
  assert.equal(resolveCypherGeneration("superhero", 100).redirect, "subtle");
});

test("manifest Teleporter placements preserve the table's named variant at the selected power", () => {
  for (const power of ["medium", "advanced", "high", "ultra"]) {
    const rows = Array.from({ length: 100 }, (_, i) => resolveCypherGeneration(power, i + 1));
    const teleporter = rows.find(row => row.logicalId === "cypher.manifest.teleporter");
    assert.ok(teleporter?.variantName);
    assert.equal(teleporter.power, power);
  }
});

test("invalid generation input never chooses a source", () => {
  for (const roll of [0, 101, NaN, Infinity, 1.5]) assert.equal(resolveCypherGeneration("subtle", roll), null);
  assert.equal(resolveCypherGeneration("invented", 1), null);
});
