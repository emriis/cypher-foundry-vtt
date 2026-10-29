import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
const root = resolve(import.meta.dirname, "../..");
const read = file => JSON.parse(readFileSync(resolve(root, file), "utf8"));
test("companion support clauses remain traceable to independently reviewed CRD paragraphs", () => {
  const evidence = read("data/crd-companion-powers.json");
  assert.equal(evidence.version, "2026-07-29"); assert.equal(evidence.entries.length, 5);
  const sources = readdirSync(resolve(root, "packs/abilities-en/_source")).filter(file => file.endsWith(".json"))
    .map(file => read(`packs/abilities-en/_source/${file}`));
  for (const rule of evidence.entries) {
    assert.ok(rule.paragraph > 0 && rule.section);
    assert.ok(sources.filter(source => source.system.key === rule.key).some(source => {
      const text = plainText(source.system.description);
      for (let index = 0; index <= text.length - rule.length; index++) {
        if (createHash("sha256").update(text.slice(index, index + rule.length)).digest("hex") === rule.sha256) return true;
      }
      return false;
    }), rule.key);
  }
});
