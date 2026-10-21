import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {readCompendiumCatalogue,readFrenchProposals,reviewCatalogue} from "../../scripts/review-translations.mjs";
const ROOT=path.resolve(import.meta.dirname,"../..");
test("PR12 Equipment and Cypher inventory is canonically complete and validated",async()=>{
 const m=JSON.parse(await fs.readFile(path.join(ROOT,"data/localization/equipment-review-pr12.json"),"utf8"));
 assert.equal(m.expected,457);assert.equal(m.ids.length,457);
 assert.equal(m.ids.filter(id=>id.startsWith("equipment.")).length,259);
 assert.equal(m.ids.filter(id=>id.startsWith("cypher.")).length,198);
 assert.equal(new Set(m.ids).size,457);
 const [records,proposals]=await Promise.all([readCompendiumCatalogue(ROOT),readFrenchProposals(ROOT)]);
 const review=reviewCatalogue(records,proposals);
 const byId=new Map(review.entries.map(row=>[row.logicalId,row]));
 for(const id of m.ids){const row=byId.get(id);assert.ok(row,id);
   assert.equal(row.status,"reviewed",id);assert.deepEqual(row.errors,[],id);
   assert.deepEqual(row.missingFields,[],id);assert.equal(row.mechanicalParity,true,id);
   assert.equal(row.sourceFields,row.translatedFields,id);
 }
 assert.equal(review.entries.length,1373);
 assert.equal(review.entries.filter(row=>row.status==="reviewed").length,1366);
 assert.equal(review.entries.filter(row=>row.status==="proposed").length,7);
 assert.equal(review.entries.filter(row=>row.logicalId.startsWith("ability.")&&row.status==="reviewed").length,701);
 assert.equal(review.entries.filter(row=>row.logicalId.startsWith("type.")&&row.status==="reviewed").length,55);
 assert.equal(review.entries.filter(row=>row.logicalId.startsWith("focus.")&&row.status==="reviewed").length,42);
});
