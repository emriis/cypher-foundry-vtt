import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {readCompendiumCatalogue,readFrenchProposals,reviewCatalogue} from "../../scripts/review-translations.mjs";
const ROOT=path.resolve(import.meta.dirname,"../..");
test("PR11 canonical coverage and inherited approvals stay intact",async()=>{
 const manifest=JSON.parse(await fs.readFile(path.join(ROOT,"data/localization/type-focus-review-pr11.json"),"utf8"));
 assert.equal(manifest.ids.length,97);
 assert.equal(manifest.ids.filter(id=>id.startsWith("type.")).length,55);
 assert.equal(manifest.ids.filter(id=>id.startsWith("focus.")).length,42);
 assert.equal(new Set(manifest.ids).size,97);
 const [records,proposals]=await Promise.all([readCompendiumCatalogue(ROOT),readFrenchProposals(ROOT)]);
 const review=reviewCatalogue(records,proposals);
 const map=new Map(review.entries.map(row=>[row.logicalId,row]));
 for(const id of manifest.ids){
   const row=map.get(id);
   assert.ok(row,id);assert.deepEqual(row.errors,[],id);
   assert.deepEqual(row.missingFields,[],id);
   assert.equal(row.sourceFields,row.translatedFields,id);
   assert.equal(row.mechanicalParity,true,id);
   assert.equal(row.status,"reviewed",id);
 }
 assert.equal(review.entries.filter(row=>row.logicalId.startsWith("ability.")&&row.status==="reviewed").length,701);
 assert.ok(review.entries.filter(row=>row.status==="reviewed").length>=909);
 assert.ok(review.entries.filter(row=>row.status==="proposed").length<=464);
});
