/**
 * Cross-family French localization integrity report.
 * Structural source parity is enforceable; narrative equivalence requires
 * separate human and Foundry in-application inspection.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {createValidationWorkspace,removeValidationWorkspace} from "./validation-workspace.mjs";
import {readCompendiumCatalogue,readFrenchProposals,reviewCatalogue} from "./review-translations.mjs";
import {materializeTranslations} from "./localization/materialize-translations.mjs";
import {readLocaleSources} from "./build-locales.mjs";
import {validateGlossary,reviewFrenchStyle} from "./localization/terminology.mjs";

/** Collect hard structural defects, and keep editorial diagnostics separate. */
export function analyzeLocalization(records, proposals, glossary, uiEn, uiFr) {
  const reviewed=reviewCatalogue(records,proposals);
  const errors=[],warnings=[];
  const english=records.filter(row=>row.pack.endsWith("-en"));
  const french=records.filter(row=>row.pack.endsWith("-fr"));
  const englishById=new Map(english.map(row=>[row.logicalId,row]));
  const frenchById=new Map(french.map(row=>[row.logicalId,row]));
  const statusCounts={},familyCounts={};
  for(const row of reviewed.entries) {
    statusCounts[row.status]=(statusCounts[row.status]??0)+1;
    const family=row.sourceFile.split("/")[1].replace(/-en$/,"");
    const f=familyCounts[family]??={total:0,reviewed:0,sourceFields:0,translatedFields:0};
    f.total++;f.sourceFields+=row.sourceFields;f.translatedFields+=row.translatedFields;
    if(row.status==="reviewed")f.reviewed++;
    if(row.status!=="reviewed"||row.errors.length||row.missingFields.length||!row.mechanicalParity||row.sourceFields!==row.translatedFields)
      errors.push({id:row.logicalId,type:"source-coverage",status:row.status,details:row.errors,missing:row.missingFields,mechanicalParity:row.mechanicalParity});
    if(!frenchById.has(row.logicalId)) errors.push({id:row.logicalId,type:"missing-french-record"});
    const en=englishById.get(row.logicalId),fr=frenchById.get(row.logicalId);
    if(en&&fr&&en.document._id!==fr.document._id)errors.push({id:row.logicalId,type:"document-identity"});
    const proposal=proposals.get(row.logicalId)?.proposal;
    for(const field of proposal?.fields??[]) {
      // Exact English reuse can be legitimate for proper nouns, abbreviations,
      // named mechanics, and shared technical labels. Review, don't fail.
      const sourceRow=englishById.get(row.logicalId);
      if(!sourceRow)continue;
      if(field.text.trim().length<30)continue;
      if(/^[\x00-\x7f]+$/.test(field.text)&&/\b(the|you|your|with|from|when|attack|skill|damage|level)\b/i.test(field.text))
        warnings.push({id:row.logicalId,field:field.path,type:"possible-english-prose"});
    }
  }
  for(const id of reviewed.orphanedProposals)errors.push({id,type:"orphan-proposal"});
  if(englishById.size!==english.length||frenchById.size!==french.length)errors.push({type:"duplicate-logical-id"});
  if(english.length!==1373||french.length!==1373||proposals.size!==1373)errors.push({type:"inventory-count",english:english.length,french:french.length,proposals:proposals.size});
  // The reviewed compiler plan must be constructible without fallback or
  // any unreviewed French field, and must preserve all document identities.
  let compiledCount=0;
  try{
    const plan=materializeTranslations(records,proposals,{requireReviewed:true});
    compiledCount=plan.size;
    if(plan.size!==1373)errors.push({type:"compiled-count",actual:plan.size});
    for(const [file,translated] of plan){
      if(translated.flags?.cypherFoundry?.translation?.status!=="reviewed")
        errors.push({type:"compiled-not-reviewed",file});
    }
  }catch(error){errors.push({type:"strict-compile",detail:String(error.message)});}
  for(const issue of validateGlossary(glossary,uiEn,uiFr))errors.push({type:"normative-glossary",detail:issue});
  const style=reviewFrenchStyle(proposals);
  return {
    schemaVersion:1,source:"Cypher Reference Document 2026-07-29",
    guarantee:"Source hashes, bilingual identities, typed mechanics, field coverage, glossary UI bindings and strict compilation only. Not semantic or UI certification.",
    summary:{english:english.length,french:french.length,proposals:proposals.size,compiled:compiledCount,statusCounts,families:familyCounts,hardErrors:errors.length,editorialWarnings:warnings.length,styleFlags:style.summary?.flags??null},
    errors,editorialWarnings:warnings,editorialStyle:style.summary,
    requiredManualChecks:["Complete sentence-by-sentence fidelity against the CRD","Terminology and conditional clauses in context","Genre/Type/Focus/Skill/Ability cross references","All bilingual compendium indices and Journal page navigation in Foundry","Rules and gameplay E2E, including effects whose automation remains incomplete"]
  };
}

export async function auditFrenchLocalization(root=path.resolve(import.meta.dirname,".."),output=path.join(root,"reports/localization-integrity.json")){
  const workspace=await createValidationWorkspace(root);
  try{
    execFileSync(process.execPath,["scripts/migrate-ability-sources.mjs"],{cwd:workspace.root,windowsHide:true,maxBuffer:8*1024*1024});
    const [records,proposals,glossaryText,en,fr]=await Promise.all([
      readCompendiumCatalogue(workspace.root),readFrenchProposals(root),
      fs.readFile(path.join(root,"data/localization/glossary-fr.json"),"utf8"),
      readLocaleSources(root,"en"),readLocaleSources(root,"fr")
    ]);
    const report=analyzeLocalization(records,proposals,JSON.parse(glossaryText),en.dictionary,fr.dictionary);
    await fs.mkdir(path.dirname(output),{recursive:true});
    await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify(report.summary,null,2));
    if(report.errors.length)throw Error("Localization integrity audit found "+report.errors.length+" hard defects. See "+output);
    return report;
  }finally{await removeValidationWorkspace(workspace.workspace);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 auditFrenchLocalization().catch(error=>{console.error(error.stack??error);process.exitCode=1;});
}
