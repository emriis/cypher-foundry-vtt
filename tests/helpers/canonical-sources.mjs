/**
 * Authoritative source reader for direct CRD tests. The FR view is derived
 * from English structural definitions, never loaded from an authored FR file.
 * Editorial localized strings are validated by the LevelDB/integrity tests.
 */
import fs from "node:fs";
import path from "node:path";
import { frenchReference } from "../../scripts/localization/derive-french-catalogue.mjs";

export function readPackSourceMap(root, pack) {
  const enPack = pack.replace(/-fr$/, "-en");
  const directory = path.join(root, "packs", enPack, "_source");
  const map = new Map();
  function visit(dir, relative = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = relative ? relative + "/" + entry.name : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full, name);
      else if (entry.name.endsWith(".json")) {
        const source = JSON.parse(fs.readFileSync(full, "utf8"));
        const doc = pack.endsWith("-fr") ? frenchReference(source) : source;
        if (pack.endsWith("-fr") && !doc._key?.startsWith("!folders!")) {
          doc.flags ??= {};
          doc.flags.cypherFoundry ??= {};
          doc.flags.cypherFoundry.crd ??= {};
          doc.flags.cypherFoundry.crd.language = "fr";
          if (doc.flags.cypherFoundry.crd.logicalId) {
            doc.flags.cypherFoundry.crd.sourceLogicalId = doc.flags.cypherFoundry.crd.logicalId;
          }
        }
        map.set(name, doc);
      }
    }
  }
  visit(directory);
  return map;
}

export function readPackSources(root, pack) {
  return [...readPackSourceMap(root, pack).values()];
}
