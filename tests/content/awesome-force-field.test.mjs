/** Source clauses are reviewed from the supplied CRD, not refreshed from changed packs. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
const root = resolve(import.meta.dirname, "../..");
const read = file => JSON.parse(readFileSync(resolve(root, file), "utf8"));
test("Awesome Force Field and its cypher template retain reviewed source clauses", () => {
  const evidence = read("data/crd-awesome-force-field.json");
  assert.equal(evidence.version, "2026-07-29"); assert.equal(evidence.entries.length, 2);
  const sources = readdirSync(resolve(root, "packs/abilities-en/_source")).filter(file => file.endsWith(".json"))
    .map(file => read(`packs/abilities-en/_source/${file}`));
  sources.push(...readdirSync(resolve(root, "packs/equipment-en/_source"), { recursive: true }).filter(file => file.endsWith(".json")).map(file => read(`packs/equipment-en/_source/${file}`)));
  sources.push(...read("data/crd-genre-abilities.json").records.map(record => ({ system: record.system })));
  for (const clause of evidence.entries) {
    assert.ok(sources.filter(source => source.system?.key === clause.key || clause.key === "force-field" && source.name === "Force Field").some(source => {
      const text = plainText(source.system.description);
      for (let index = 0; index <= text.length - clause.length; index++) {
        if (createHash("sha256").update(text.slice(index, index + clause.length)).digest("hex") === clause.sha256) return true;
      }
      return false;
    }), `${clause.key}:${clause.start}`);
  }
});
