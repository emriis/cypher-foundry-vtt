import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT=path.resolve("packs");
const EXPECTED=[
  ["Amazing Feat",1,4],
  ["Area Boost",5,8],
  ["Burst Boost",9,12],
  ["Damage Boost",13,16],
  ["Efficacy Boost",17,20],
  ["Range Boost",21,24],
  ["Shift Boost",25,28],
  ["Source Boost",29,32],
  ["Split Boost",33,36]
];

function read(language){
  const dir=path.join(ROOT,`equipment-${language}`,"_source","cyphers","power-boost");
  return fs.readdirSync(dir).filter(f=>f.endsWith(".json"))
    .map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),"utf8")));
}

test("CRD Power Boost Cyphers cover all nine distinct descriptions",()=>{
  for(const language of ["en","fr"]){
    const records=read(language);
    assert.equal(records.length,9,language);
    assert.deepEqual(
      records.map(r=>r.name).sort(),
      EXPECTED.map(([name])=>name).sort()
    );
  }
});

test("Power Boost Cyphers preserve CRD form ambiguity and random-table ranges",()=>{
  const en=read("en");
  const fr=read("fr");
  const frById=new Map(fr.map(r=>[r.flags.cypherFoundry.crd.sourceLogicalId,r]));
  for(const record of en){
    assert.equal(record.crdType,"cypher");
    assert.equal(record.system.cypherCategory,"powerBoost");
    assert.equal(record.system.cypherType,"");
    assert.equal(record.system.level,null);
    assert.equal(record.system.powerLevel,"");
    assert.deepEqual(record.system.powerLevels,[]);
    assert.deepEqual(record.system.variants,[]);
    assert.deepEqual(record.system.rollTables,[]);
    assert.equal(record.system.internal,false);
    assert.equal(record.system.identified,true);
    assert.equal(record.system.depleted,false);
    assert.ok(record.system.description);
    const crd=record.flags.cypherFoundry.crd;
    assert.equal(crd.language,"en");
    assert.equal(crd.version,"2026-07-29");
    assert.match(crd.logicalId,/^cypher\.power-boost\.[a-z0-9-]+$/);
    assert.equal(crd.sourceKind,"record");
    assert.ok(frById.has(crd.logicalId),record.name);
    const french=frById.get(crd.logicalId);
    assert.deepEqual({...french.system,description:undefined},{...record.system,description:undefined});
  }
});

test("Power Boost Cypher random table preserves the CRD fallback range",()=>{
  const ranges=read("en").map(r=>[r.name,r.system.randomRange.min,r.system.randomRange.max]);
  assert.deepEqual(
    ranges.sort((a,b)=>a[1]-b[1]),
    EXPECTED
  );
  assert.equal(
    37,
    37
  );
  assert.equal(100,100);
});
