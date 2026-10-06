import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT=path.resolve("packs");

function readManifest(language){
  const base=path.join(ROOT,`equipment-${language}`,"_source","cyphers","manifest");
  const records=[];
  function visit(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()) visit(full);
      else if(entry.name.endsWith(".json")) records.push(JSON.parse(fs.readFileSync(full,"utf8")));
    }
  }
  visit(base);
  return records;
}

test("CRD manifest cyphers cover the complete 103-entry inventory",()=>{
  for(const language of ["en","fr"]){
    const records=readManifest(language);
    assert.equal(records.length,103,language);
    assert.equal(records.filter(r=>r.system.cypherType==="manifest").length,103);
    assert.equal(records.filter(r=>r.system.level===6).length,103);
  }
});

test("CRD manifest cyphers preserve source identity and random ranges",()=>{
  const en=readManifest("en");
  const fr=readManifest("fr");
  const frBySourceId=new Map(fr.map(r=>[r.flags.cypherFoundry.crd.sourceLogicalId,r]));
  const ids=new Set();

  for(const record of en){
    const crd=record.flags.cypherFoundry.crd;
    assert.equal(record.document,"Item");
    assert.equal(record.type,"cypher");
    assert.equal(record.crdType,"cypher");
    assert.equal(crd.version,"2026-07-29");
    assert.equal(crd.language,"en");
    assert.match(crd.logicalId,/^cypher\.manifest\.[a-z0-9-]+$/);
    assert.equal(record.system.level,6);
    assert.ok(Array.isArray(record.system.powerLevels));
    assert.ok(record.system.description);
    assert.ok(!ids.has(crd.logicalId),crd.logicalId);
    ids.add(crd.logicalId);
    assert.ok(frBySourceId.has(crd.logicalId),record.name);
    const french=frBySourceId.get(crd.logicalId);
    assert.deepEqual(
      {...french.system,description:undefined},
      {...record.system,description:undefined}
    );
  }
  assert.equal(ids.size,103);
});

test("Teleporter keeps its four CRD power variants in one record",()=>{
  const teleporter=readManifest("en").find(r=>r.name==="Teleporter");
  assert.ok(teleporter);
  assert.equal(teleporter.system.powerLevel,"");
  assert.deepEqual(teleporter.system.powerLevels,["medium","advanced","high","ultra"]);
  assert.deepEqual(
    teleporter.system.variants.map(v=>[v.name,v.powerLevel,v.rollMin,v.rollMax]),
    [
      ["Bounder","medium",1,50],
      ["Traveler","advanced",51,80],
      ["Planetary","high",81,95],
      ["Interstellar","ultra",96,100]
    ]
  );
  assert.equal(teleporter.system.randomRange.min,null);
  assert.equal(teleporter.system.randomRange.max,null);
});

test("Manifest Cyphers preserve the CRD embedded d00 tables",()=>{
  for(const name of ["Energy Blast","Image Projector"]){
    const record=readManifest("en").find(r=>r.name===name);
    assert.ok(record,name);
    assert.equal(record.system.rollTables.length,1,name);
    assert.equal(record.system.rollTables[0].formula,"1d100",name);
  }
});
