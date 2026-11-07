import { EXPECTED_CATALOGUE_COUNT } from "../../scripts/crd-reference/inventory.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import {auditFrenchLocalization,analyzeLocalization} from "../../scripts/audit-localization-integrity.mjs";

test("all bilingual documents pass a strict, source-backed cross-family audit",async()=>{
 const report=await auditFrenchLocalization();
 assert.deepEqual(report.errors,[]);
 assert.equal(report.summary.english,EXPECTED_CATALOGUE_COUNT);
 assert.equal(report.summary.french,EXPECTED_CATALOGUE_COUNT);
 assert.equal(report.summary.proposals,EXPECTED_CATALOGUE_COUNT);
 assert.equal(report.summary.compiled,EXPECTED_CATALOGUE_COUNT);
 assert.deepEqual(report.summary.statusCounts,{reviewed:EXPECTED_CATALOGUE_COUNT});
 for(const count of [701,58,53,55,42,457,20])
   assert.ok(Object.values(report.summary.families).some(f=>f.total===count),"Missing canonical family "+count);
});
