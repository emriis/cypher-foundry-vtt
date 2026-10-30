import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
import { COMPANION_UPGRADES } from "../../module/rules/companion-upgrades.mjs";
const root = resolve(import.meta.dirname, "../..");
const read = file => JSON.parse(readFileSync(resolve(root, file), "utf8"));
test("automaton upgrades and Beast Eyes retain their independently reviewed CRD clauses", () => {
  const evidence = read("data/crd-companion-upgrades.json");
  assert.equal(evidence.version, "2026-07-29");
  assert.deepEqual(evidence.entries.map(entry => entry.key).sort(), Object.keys(COMPANION_UPGRADES).sort());
  const sources = readdirSync(resolve(root, "packs/abilities-en/_source")).filter(file => file.endsWith(".json"))
    .map(file => read(`packs/abilities-en/_source/${file}`));
  for (const entry of evidence.entries) {
    assert.equal(entry.paragraph, COMPANION_UPGRADES[entry.key].paragraph);
    assert.ok(sources.filter(source => source.system.key === entry.key).some(source => {
      const text = plainText(source.system.description);
      for (let index = 0; index <= text.length - entry.length; index++) {
        if (createHash("sha256").update(text.slice(index, index + entry.length)).digest("hex") === entry.sha256) return true;
      }
      return false;
    }), entry.key);
  }
});
