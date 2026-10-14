/** Keep new source entries and changed passages visible to translation authors. */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readCompendiumCatalogue, readFrenchProposals, reviewCatalogue } from "../../scripts/review-translations.mjs";
import { materializeTranslations } from "../../scripts/localization/materialize-translations.mjs";

test("Given normalized bilingual CRD sources, when the complete French preview is compiled, then every source field has a fresh guarded translation with unchanged mechanics", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const [records, proposals] = await Promise.all([readCompendiumCatalogue(root), readFrenchProposals(root)]);
  const report = reviewCatalogue(records, proposals);
  assert.deepEqual(report.orphanedProposals, []);
  for (const entry of report.entries) {
    assert.ok(["proposed", "reviewed"].includes(entry.status), `${entry.logicalId}: ${entry.status}; ${entry.errors.join(" ")}`);
    assert.equal(entry.translatedFields, entry.sourceFields, entry.logicalId);
    assert.equal(entry.mechanicalParity, true, entry.logicalId);
  }
  const plan = materializeTranslations(records, proposals, { includeProposed: true });
  assert.equal(plan.size, report.entries.length);
  for (const document of plan.values()) assert.ok(["proposed", "reviewed"].includes(document.flags.cypherFoundry.translation.status));
});
