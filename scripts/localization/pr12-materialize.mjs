import fs from "node:fs/promises";
import path from "node:path";
import {execFileSync} from "node:child_process";
const root=process.cwd();
const m=JSON.parse(await fs.readFile(path.join(root,"data/localization/equipment-review-pr12.json"),"utf8"));
if(m.expected!==457||m.ids.length!==457||new Set(m.ids).size!==457)throw Error("Manifest inventory mismatch");
const dir=path.join(root,"translations/fr/equipment");
let changed=0, already=0;
for(const id of m.ids){const file=path.join(dir,id+".json");const record=JSON.parse(await fs.readFile(file,"utf8"));
 if(record.logicalId!==id||record.sourceLogicalId!==id||record.language!=="fr"||!Array.isArray(record.fields)||!record.fields.length)throw Error("Invalid source-paired record "+id);
 if(record.status==="reviewed"){already++;continue;}
 if(record.status!=="proposed")throw Error("Unexpected proposal status "+id+": "+record.status);
 record.status="reviewed";await fs.writeFile(file,JSON.stringify(record,null,2)+String.fromCharCode(10));changed++;
}
const actual=(await fs.readdir(dir)).filter(n=>n.endsWith(".json"));
if(actual.length!==457)throw Error("Unexpected translation file count "+actual.length);
console.log(JSON.stringify({changed,already,total:changed+already}));
if(changed){execFileSync("git",["config","user.name","github-actions[bot]"]);execFileSync("git",["config","user.email","41898282+github-actions[bot]@users.noreply.github.com"]);
 execFileSync("git",["add","translations/fr/equipment"]);execFileSync("git",["commit","-m","feat(i18n): record PR12 equipment and cypher French proposal statuses"] ,{stdio:"inherit"});
 execFileSync("git",["push","origin","HEAD:feat/pr12-equipment-fr-review"],{stdio:"inherit"});}
