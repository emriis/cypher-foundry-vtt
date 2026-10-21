/** Rules Journal bilingual comparative report for all seven Rules Journals.
 * Never automatically approves editorial drafts.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {createValidationWorkspace,removeValidationWorkspace} from "./validation-workspace.mjs";
import {readCompendiumCatalogue,readFrenchProposals,reviewCatalogue} from "./review-translations.mjs";
import {inspectAbilityPair8} from "./audit-ability-batch-2.mjs";
const ROOT=path.resolve(import.meta.dirname,"..");
const MANIFEST="data/localization/rules-journals-review.json";
export async function auditRulesJournals(root=ROOT,output=path.join(root,"reports/rules-journals-review.json")){
 const manifest=JSON.parse(await fs.readFile(path.join(root,MANIFEST),"utf8"));
 const proposals=await readFrenchProposals(root);
 const current=[...proposals.keys()].filter(id=>id.startsWith("journal.")).sort();
 if(manifest.expected!==7||manifest.ids.length!==7||new Set(manifest.ids).size!==7||
    current.length!==7||JSON.stringify(current)!==JSON.stringify(manifest.ids)||
    manifest.ids.some(id=>!id.startsWith("journal."))){
   throw new Error("Rules Journal canonical Rules Journals inventory drift");}
 const workspace=await createValidationWorkspace(root);
 try{
   execFileSync(process.execPath,["scripts/migrate-ability-sources.mjs"],{cwd:workspace.root,windowsHide:true,maxBuffer:8*1024*1024});
   const records=await readCompendiumCatalogue(workspace.root);
   const audits=reviewCatalogue(records,proposals);
   const checks=new Map(audits.entries.map(row=>[row.logicalId,row]));
   const sources=new Map(records.filter(row=>row.pack==="rules-en").map(row=>[row.logicalId,row]));
   const details=manifest.ids.map(id=>{
     const source=sources.get(id),item=proposals.get(id),check=checks.get(id);
     if(!source||!item||!check||check.errors.length||check.missingFields.length||
       !check.mechanicalParity||check.sourceFields!==check.translatedFields){
       throw new Error("Rules Journal bilingual field/mechanic mismatch: "+id+" "+JSON.stringify(check));}
     return {...inspectAbilityPair8(id,source.document,item.proposal),status:item.proposal.status,sourceFile:source.file,proposalFile:item.file};
   });
   const report={version:1,scope:manifest.scope,reference:manifest.reference,expected:7,
    semanticCertification:false,warning:"Automated checks cannot approve Rules Journals semantic fidelity.",
    statuses:details.reduce((a,row)=>(a[row.status]=(a[row.status]??0)+1,a),{}),details};
   await fs.mkdir(path.dirname(output),{recursive:true});
   await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
   console.log(JSON.stringify({scope:report.scope,counts:report.statuses,first:manifest.ids[0],last:manifest.ids.at(-1)}));
   return report;
 }finally{await removeValidationWorkspace(workspace.workspace);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 auditRulesJournals().catch(e=>{console.error(e.stack??e.message);process.exitCode=1;});
}
