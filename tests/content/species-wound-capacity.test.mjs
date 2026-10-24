/** Independent CRD expectations for the three species capacity clauses. */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readPackSourceMap, readPackSources as canonicalPackSources } from "../helpers/canonical-sources.mjs";
import { readFile } from "node:fs/promises";

for (const species of ["drakain", "orc", "prota"]) {
  test(`${species} pairs one source-backed extra minor wound in EN/FR`, async () => {
    // CRD 2026-07-29 > Fantasy Species > Orc;
    // Science Fiction Species > Drakain / Prota: one more minor wound.
    for (const language of ["en", "fr"]) {
      const source = readPackSourceMap(path.resolve(import.meta.dirname, "../.."),
        `descriptors-${language}`).get(`species/${species}.json`);
      const benefits = source.system.benefits.filter(benefit => benefit.passiveModifiers?.length);
      assert.equal(benefits.length, 1, `${language}/${species}: exactly the reviewed capacity clause`);
      assert.deepEqual(benefits[0].passiveModifiers, [{ kind: "woundCapacity", stat: "", severity: "minor", amount: 1 }]);
      assert.equal(source.system.category, "species");
    }
  });
}
