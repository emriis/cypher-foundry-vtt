import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { selectPR10Abilities } from "../../scripts/audit-ability-batch-4.mjs";
import { readCompendiumCatalogue, readFrenchProposals, reviewCatalogue } from "../../scripts/review-translations.mjs";
const ROOT = path.resolve(import.meta.dirname, "../..");

test("PR10 locks and checks the last 176 reviewed Ability IDs after 525 earlier approvals", async () => {
  const manifests = await Promise.all([1,2,3,4].map(async n =>
    JSON.parse(await fs.readFile(path.join(ROOT, "data/localization/ability-review-batch-"+n+".json"),"utf8"))));
  const previous = manifests.slice(0,3).flatMap(x=>x.ids), current=manifests[3].ids;
  assert.equal(previous.length,525);
  assert.equal(current.length,176);
  assert.equal(new Set([...previous,...current]).size,701);
  assert.equal(current[0],"ability.resuscitate");
  assert.equal(current.at(-1),"ability.wraith-cloak");
  const proposals=await readFrenchProposals(ROOT);
  const chosen=await selectPR10Abilities(ROOT,proposals);
  assert.deepEqual(chosen,current);
  const records=await readCompendiumCatalogue(ROOT);
  const report=reviewCatalogue(records,proposals);
  const byId=new Map(report.entries.map(x=>[x.logicalId,x]));
  assert.equal(report.entries.filter(x=>x.logicalId.startsWith("ability.")).length,701);
  for(const id of previous){
    assert.equal(byId.get(id)?.status,"reviewed","Earlier approval lost: "+id);
  }
  for(const id of current){
    const row=byId.get(id);
    assert.ok(row,id);
    assert.equal(row.status,"reviewed","PR10 Ability review lost: "+id);
    assert.deepEqual(row.errors,[],id);
    assert.deepEqual(row.missingFields,[],id);
    assert.equal(row.mechanicalParity,true,id);
    assert.equal(row.sourceFields,row.translatedFields,id);
  }
  for(const id of ["ability.safe-fall-2c752623835e","ability.safe-fall-b4495c46a2ec",
    "ability.spray-537e80df711f","ability.spray-a8bbd467264b",
    "ability.telekinesis-63c5636158a2","ability.telekinesis-94fdd863524f",
    "ability.wounded-fury-a4a66a23e161","ability.wounded-fury-e1d585e375b8",
    "ability.wounded-fury-e58a6c9dcfd9"]) assert.ok(current.includes(id),id);
  assert.equal(report.entries.filter(x=>x.status==="reviewed").length,812);
  assert.equal(report.entries.filter(x=>x.status==="proposed").length,561);
});
