/** Read canonical identities without normalizing the user's authoring tree. */
import { execFileSync } from "node:child_process";
import { readCompendiumCatalogue } from "../review-translations.mjs";
import { proposedFoundryId } from "../source-migration/id-contract.mjs";
import { createValidationWorkspace, removeValidationWorkspace } from "../validation-workspace.mjs";

/** Already normalized test checkouts need no second copy. Legacy authoring input
 * is normalized in an owned disposable workspace before any reference is built.
 */
export async function readReferenceCatalogue(root) {
  const records = await readCompendiumCatalogue(root, { languages: ["en"] });
  if (records.every(row => row.logicalId && row.document._id === proposedFoundryId(row.logicalId))) return records;
  const workspace = await createValidationWorkspace(root);
  try {
    execFileSync(process.execPath, ["scripts/migrate-ability-sources.mjs", "--english-only"],
      { cwd: workspace.root, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    return await readCompendiumCatalogue(workspace.root, { languages: ["en"] });
  } finally { await removeValidationWorkspace(workspace.workspace); }
}
