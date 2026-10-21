import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {readCompendiumCatalogue,readFrenchProposals,reviewCatalogue} from "../../scripts/review-translations.mjs";
const ROOT=path.resolve(import.meta.dirname,"../..");
test("all seven Rules Journals retain canonical identity, source text coverage and mechanical parity",async()=>{
 const m=JSON.parse(await fs.readFile(path.join(ROOT,"data/localization/rules-journals-review.json"),"utf8"));
 assert.equal(m.expected,7);assert.equal(m.ids.length,7);assert.equal(new Set(m.ids).size,7);
 const [records,proposals]=await Promise.all([readCompendiumCatalogue(ROOT),readFrenchProposals(ROOT)]);
 const review=reviewCatalogue(records,proposals);const map=new Map(review.entries.map(row=>[row.logicalId,row]));
 const sources=new Map(records.filter(row=>row.pack==="rules-en").map(row=>[row.logicalId,row]));
 const counterparts=new Map(records.filter(row=>row.pack==="rules-fr").map(row=>[row.logicalId,row]));
 for(const id of m.ids){const row=map.get(id),en=sources.get(id),fr=counterparts.get(id);
   assert.ok(row&&en&&fr,id);assert.equal(row.status,"reviewed",id);
   assert.equal(en.document._id,fr.document._id,id);
   assert.deepEqual(row.errors,[],id);assert.deepEqual(row.missingFields,[],id);
   assert.equal(row.mechanicalParity,true,id);assert.equal(row.sourceFields,row.translatedFields,id);
   const proposal=proposals.get(id)?.proposal;assert.ok(proposal,id);
   assert.ok(proposal.fields.some(f=>f.path.endsWith(".text.content")),id);
 }
 assert.equal(sources.size,7);assert.equal(counterparts.size,7);
 assert.equal(review.entries.length,1373);
 assert.equal(review.entries.filter(row=>row.status==="reviewed").length,1373);
 assert.equal(review.entries.filter(row=>row.status==="proposed").length,0);
 assert.deepEqual(review.orphanedProposals,[]);
});
