import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = JSON.parse(await readFile(
  new URL("../../data/crd-genre-abilities.json", import.meta.url),
  "utf8"
));
const byId = new Map(source.records.map(record => [record.logicalId, record]));

test("CRD Spray source encodes rapid-fire and thrown-weapon alternatives", () => {
  assert.deepEqual(byId.get("ability.spray").system.weaponPrerequisites, [
    { kind: "rapidFire", alternativeGroup: "weapon-use", value: "" },
    { kind: "thrownWeaponsInReach", alternativeGroup: "weapon-use", value: "" }
  ]);
});

test("CRD Arc Spray source encodes rapid-fire as its sole weapon prerequisite", () => {
  assert.deepEqual(byId.get("ability.arc-spray").system.weaponPrerequisites, [
    { kind: "rapidFire", alternativeGroup: "weapon-use", value: "" }
  ]);
});
