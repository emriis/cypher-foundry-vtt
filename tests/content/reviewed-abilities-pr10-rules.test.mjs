/** PR10 content contracts for the last 176 distinct canonical Abilities. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {readCompendiumCatalogue,readFrenchProposals,reviewCatalogue} from "../../scripts/review-translations.mjs";
import {materializeTranslations} from "../../scripts/localization/materialize-translations.mjs";
const ROOT=path.resolve(import.meta.dirname,"../..");

test("all 701 Ability translations compile as reviewed without changing mechanics",async()=>{
  const [records,proposals]=await Promise.all([readCompendiumCatalogue(ROOT),readFrenchProposals(ROOT)]);
  const report=reviewCatalogue(records,proposals);
  const ids=JSON.parse(await fs.readFile(path.join(ROOT,"data/localization/ability-review-batch-4.json"),"utf8")).ids;
  const en=new Map(records.filter(row=>row.pack==="abilities-en").map(row=>[row.logicalId,row]));
  const fr=new Map(records.filter(row=>row.pack==="abilities-fr").map(row=>[row.logicalId,row]));
  const materialized=materializeTranslations(records,proposals);
  assert.equal(en.size,701);assert.equal(fr.size,701);
  for(const id of ids){
    const english=en.get(id), french=fr.get(id);
    assert.ok(english&&french,id);
    assert.equal(english.document._id,french.document._id,id);
    assert.deepEqual(english.document.system.cost,french.document.system.cost,id);
    assert.equal(english.document.system.tier,french.document.system.tier,id);
    assert.equal(english.document.system.enabler,french.document.system.enabler,id);
    assert.equal(english.document.system.repeatable,french.document.system.repeatable,id);
    const row=report.entries.find(r=>r.logicalId===id);
    assert.equal(row.status,"reviewed",id);
    assert.equal(row.sourceFields,row.translatedFields,id);
    assert.deepEqual(row.errors,[],id);
    assert.deepEqual(row.missingFields,[],id);
    assert.equal(row.mechanicalParity,true,id);
    const output=materialized.get(french.file);
    assert.ok(output,id);
    assert.equal(output.flags.cypherFoundry.translation.status,"reviewed",id);
    assert.equal(output.flags.cypherFoundry.translation.sourceLanguage,"fr",id);
  }
});

test("PR10 translations preserve essential source limitations and distinct variants",async()=>{
  const proposals=await readFrenchProposals(ROOT);
  const desc=id=>proposals.get(id)?.proposal.fields.find(f=>f.path==="system.description")?.text??"";
  const checks=[
    ["ability.resuscitate",[/moins d’une minute/u,/niveau 6/u,/3 blessures mineures/u,/coût.*3/u]],
    ["ability.severe-machine-disruption",[/dix minutes/u,/aucune action pendant un round/u,/deux niveaux d’Effort/u]],
    ["ability.shot-collision",[/Une fois par round/u,/2 dégâts/u,/1 dégât/u,/jet d’attaque distinct/u]],
    ["ability.superheroics",[/blessure modérée/u,/deux niveaux d’Effort gratuits/u,/limite d’Effort/u]],
    ["ability.spray-537e80df711f",[/1d6 \+ 1/u,/arbalète à manivelle/u,/armes de jet/u,/1 dégât de moins/u]],
    ["ability.spray-a8bbd467264b",[/1d6 \+ 1/u,/arbalète à manivelle/u,/armes de jet/u,/1 dégât de moins/u]],
    ["ability.sneak-attack-3370384928b5",[/armes moyennes ou lourdes/u,/surprise/u,/\+5 dégâts/u]],
    ["ability.sneak-attack-b2ad99c00056",[/armes moyennes ou lourdes/u,/surprise/u,/5 dégâts supplémentaires/u]],
    ["ability.unyielding-shield",[/1d6 jours/u,/difficulté 2/u,/perdre votre prochain tour/u]],
    ["ability.wounded-fury-a4a66a23e161",[/deux niveaux d’Effort gratuits/u,/trois blessures modérées/u]],
    ["ability.wounded-fury-e1d585e375b8",[/un niveau d’Effort gratuit/u,/rang 3/u,/deux niveaux d’Effort gratuits/u]],
    ["ability.wounded-fury-e58a6c9dcfd9",[/un niveau d’Effort gratuit/u,/rang 3/u,/deux niveaux d’Effort gratuits/u]],
    ["ability.winter-gauntlets",[/Éclair de givre/u,/Étreinte hivernale/u]]
  ];
  for(const [id,patterns] of checks){
    assert.equal(proposals.get(id)?.proposal.status,"reviewed",id);
    const text=desc(id);assert.ok(text,id);
    for(const pattern of patterns)assert.match(text,pattern,id);
  }
});
