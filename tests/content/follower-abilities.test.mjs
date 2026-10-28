import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { FOLLOWER_ABILITIES } from "../../module/rules/follower-abilities.mjs";
import { plainText } from "../../scripts/crd-audit/text-fidelity.mjs";
import { deriveFrenchCatalogue } from "../../scripts/localization/derive-french-catalogue.mjs";
import { auditAutomation } from "../../scripts/crd-audit/automation.mjs";
const root = resolve(import.meta.dirname, "../..");
const read = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));

test("permanent follower contracts trace to independently reviewed CRD paragraphs and preserve EN/FR technical keys", () => {
  const evidence = read("data/crd-follower-abilities.json");
  const records = readdirSync(resolve(root, "packs/abilities-en/_source")).filter(file => file.endsWith(".json"))
    .map(file => ({ file: `packs/abilities-en/_source/${file}`, document: read(`packs/abilities-en/_source/${file}`) }));
  assert.equal(evidence.version, "2026-07-29");
  assert.deepEqual(evidence.entries.map(entry => entry.key).sort(), Object.keys(FOLLOWER_ABILITIES).sort());
  for (const entry of evidence.entries) {
    assert.ok(FOLLOWER_ABILITIES[entry.key].paragraphs.includes(entry.paragraph));
    const candidates = records.filter(record => record.document.system.key === entry.key);
    const matching = candidates.find(record => createHash("sha256").update(plainText(record.document.system.description).slice(0, entry.length)).digest("hex") === entry.sha256);
    assert.ok(matching, `Source passage for ${entry.key}`);
    const logicalId = matching.document.flags?.cypherFoundry?.crd?.logicalId ?? `ability.${entry.key}`;
    matching.document.flags ??= {};
    matching.document.flags.cypherFoundry ??= { crd: { logicalId } };
    const french = deriveFrenchCatalogue([{ ...matching, logicalId, pack: "abilities-en" }])[0].document;
    assert.equal(french.system.key, entry.key);
    assert.equal(french.flags.cypherFoundry.crd.sourceLogicalId, logicalId);
  }
});

test("runtime audit distinguishes permanent benefits from unimplemented companion powers", () => {
  const audit = auditAutomation({ type: "ability", system: { key: "mount" } });
  assert.equal(audit.status, "partial-or-adjudicated");
  assert.ok(audit.implemented.some(entry => entry.includes("follower-ability-service")));
  assert.ok(audit.gaps.some(entry => entry.includes("mounted combat")));
  assert.ok(!auditAutomation({ type: "ability", system: { key: "basic-necromancy" } }).implemented.some(entry => entry.includes("follower-ability-service")));
});
