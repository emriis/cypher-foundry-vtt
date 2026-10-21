import assert from "node:assert/strict";
import test from "node:test";
import {auditFrenchLocalization,analyzeLocalization} from "../../scripts/audit-localization-integrity.mjs";

test("all bilingual documents pass a strict, source-backed cross-family audit",async()=>{
 const report=await auditFrenchLocalization();
 assert.deepEqual(report.errors,[]);
 assert.equal(report.summary.english,1373);
 assert.equal(report.summary.french,1373);
 assert.equal(report.summary.proposals,1373);
 assert.equal(report.summary.compiled,1373);
 assert.deepEqual(report.summary.statusCounts,{reviewed:1373});
 for(const count of [701,58,53,55,42,457,7])
   assert.ok(Object.values(report.summary.families).some(f=>f.total===count),"Missing canonical family "+count);
});
