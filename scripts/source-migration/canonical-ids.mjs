/**
 * Final post-normalization identity migration for all seven bilingual packs.
 *
 * Earlier migrators resolve legacy English/French source pairs and mechanics.
 * This final pass can therefore derive one ID from each canonical English CRD
 * logical identity, and rewrite references without looking at French prose.
 * Writes only the configured checkout; callers validate in owned temporary copies.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { root } from "./context.mjs";
import { proposedLogicalId, proposedFoundryId, proposedFolderId, proposedPageId } from "./id-contract.mjs";

const PACK_PATTERN = /^(abilities|skills|descriptors|types|foci|equipment|rules)-(en|fr)$/;
const UUID_PATTERN = /Compendium\.cypher\.([a-z-]+)\.(Item|JournalEntry)\.([A-Za-z0-9]{16})(?:\.JournalEntryPage\.([A-Za-z0-9]{16}))?/g;

function groupKey(family, logicalId) {
  return family + ":" + logicalId;
}

/** Resolve all materialized documents and Folder entries from authored JSON. */
async function catalogue(checkout) {
  const rows = [];
  for (const pack of (await fs.readdir(path.join(checkout, "packs"))).filter(name => PACK_PATTERN.test(name)).sort()) {
    const base = path.join(checkout, "packs", pack, "_source");
    for (const relative of (await fs.readdir(base, { recursive: true })).filter(name => name.endsWith(".json")).sort()) {
      const file = path.join(base, relative);
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      rows.push({ pack, family: pack.replace(/-(?:en|fr)$/, ""), language: pack.slice(-2),
        relative: relative.replaceAll(path.sep, "/"), file, data,
        folder: data._key?.startsWith("!folders!") });
    }
  }
  return rows;
}

/** Apply a known compendium UUID substitution in stored structured and HTML text. */
export function rewriteCompendiumLinks(value, mapped) {
  if (typeof value === "string") {
    return value.replace(UUID_PATTERN, (uuid, pack, kind, id, pageId) => {
      // Keep third-party links outside this system untouched.
      if (!PACK_PATTERN.test(pack)) return uuid;
      const replacement = mapped.get(uuid);
      if (!replacement) throw new Error("Unresolved Cypher compendium UUID: " + uuid);
      return replacement;
    });
  }
  if (Array.isArray(value)) return value.map(item => rewriteCompendiumLinks(item, mapped));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, rewriteCompendiumLinks(item, mapped)]));
  }
  return value;
}

/**
 * Build the new identity map and apply it only after validating all counterparts,
 * collisions, journal-page anchors, folders and pre-existing references.
 * @param {string} checkout Valid owned authoring checkout/root.
 * @returns {Promise<object>} Migration counts; all sources rewritten once validation succeeds.
 */
export async function migrateCanonicalIds(checkout = root, { englishOnly = false } = {}) {
  const rows = (await catalogue(checkout)).filter(row => !englishOnly || row.language === "en");
  const pairs = new Map();
  const folders = new Map();
  const UUIDs = new Map();
  const abilityIds = new Map();
  const folderIds = new Map();
  const oldDocumentIds = new Map();
  const assigned = new Map();

  // Collect and validate complete EN/FR pairings before changing anything.
  for (const row of rows) {
    if (row.folder) {
      const key = row.family + ":" + row.relative;
      const pair = folders.get(key) ?? {};
      if (pair[row.language]) throw new Error("Duplicate Folder source: " + key + "/" + row.language);
      pair[row.language] = row;
      folders.set(key, pair);
      continue;
    }
    const oldLogical = row.data.flags?.cypherFoundry?.crd?.logicalId;
    if (!oldLogical) throw new Error("Missing CRD logicalId: " + row.file);
    const id = proposedLogicalId(oldLogical);
    const key = groupKey(row.family, id);
    const pair = pairs.get(key) ?? { canonical: id };
    if (pair[row.language]) throw new Error("Duplicate canonical logicalId: " + key + "/" + row.language);
    pair[row.language] = row;
    pairs.set(key, pair);

    const nextId = proposedFoundryId(id);
    const targetKey = row.pack + ":" + nextId;
    const previous = assigned.get(targetKey);
    if (previous && previous !== id) throw new Error("New Foundry ID collision: " + previous + ", " + id);
    assigned.set(targetKey, id);
    const kind = row.data.document === "JournalEntry" ? "JournalEntry" : "Item";
    const oldUuid = "Compendium.cypher." + row.pack + "." + kind + "." + row.data._id;
    const newUuid = "Compendium.cypher." + row.pack + "." + kind + "." + nextId;
    if (UUIDs.has(oldUuid)) throw new Error("Duplicate old UUID: " + oldUuid);
    UUIDs.set(oldUuid, newUuid);
    oldDocumentIds.set(row, { id: nextId, logicalId: id, kind });
    if (row.family === "abilities") {
      const scoped = row.pack + ":" + row.data._id;
      if (abilityIds.has(scoped)) throw new Error("Duplicate Ability ID: " + scoped);
      abilityIds.set(scoped, nextId);
    }
  }

  for (const [key, pair] of pairs) {
    if (!pair.en || (!englishOnly && !pair.fr)) throw new Error("Missing bilingual CRD source: " + key);
    if (pair.fr && (pair.en.data.document !== pair.fr.data.document || pair.en.data.type !== pair.fr.data.type)) {
      throw new Error("Bilingual document kind differs: " + key);
    }
    const englishPages = pair.en.data.pages ?? [];
    const frenchPages = pair.fr?.data.pages ?? [];
    if (!englishOnly && englishPages.length !== frenchPages.length) throw new Error("Journal page count differs: " + key);
    for (const [index, english] of englishPages.entries()) {
      const anchor = english.flags?.cypherFoundry?.identity?.sourcePageId ?? english._id;
      if (!anchor) throw new Error("Missing Journal page ID: " + key + "/" + index);
      const targetId = proposedPageId(pair.canonical, anchor);
      for (const row of englishOnly ? [pair.en] : [pair.en, pair.fr]) {
        const page = row.data.pages[index];
        const oldPageUuid = "Compendium.cypher." + row.pack + ".JournalEntry." +
          row.data._id + ".JournalEntryPage." + page._id;
        const newPageUuid = "Compendium.cypher." + row.pack + ".JournalEntry." +
          proposedFoundryId(pair.canonical) + ".JournalEntryPage." + targetId;
        if (UUIDs.has(oldPageUuid) && UUIDs.get(oldPageUuid) !== newPageUuid) {
          throw new Error("Conflicting Journal page UUID: " + oldPageUuid);
        }
        UUIDs.set(oldPageUuid, newPageUuid);
        page.flags ??= {};
        page.flags.cypherFoundry ??= {};
        page.flags.cypherFoundry.identity ??= {};
        page.flags.cypherFoundry.identity.sourcePageId = anchor;
        page._id = targetId;
        page._key = "!journal.pages!" + proposedFoundryId(pair.canonical) + "." + targetId;
      }
    }
  }

  for (const [key, pair] of folders) {
    if (!pair.en || (!englishOnly && !pair.fr)) throw new Error("Missing bilingual Folder: " + key);
    const id = proposedFolderId(pair.en.family, pair.en.relative);
    for (const row of englishOnly ? [pair.en] : [pair.en, pair.fr]) {
      if (folderIds.has(row.pack + ":" + row.data._id)) {
        throw new Error("Duplicate old Folder ID in " + row.pack);
      }
      folderIds.set(row.pack + ":" + row.data._id, id);
    }
  }

  // References are rebased on the final per-pack IDs, never a text replacement
  // of bare hexadecimal sequences that could be effect/table IDs.
  for (const row of rows) {
    const data = row.data;
    if (row.folder) {
      const id = folderIds.get(row.pack + ":" + data._id);
      if (!id) throw new Error("Unresolved Folder: " + row.file);
      if (data.folder) {
        const parent = folderIds.get(row.pack + ":" + data.folder);
        if (!parent) throw new Error("Unresolved parent Folder: " + row.file);
        data.folder = parent;
      }
      data._id = id;
      data._key = "!folders!" + id;
    } else {
      const next = oldDocumentIds.get(row);
      if (data.folder) {
        const target = folderIds.get(row.pack + ":" + data.folder);
        if (!target) throw new Error("Unresolved Item.folder: " + row.file);
        data.folder = target;
      }
      data._id = next.id;
      data._key = (next.kind === "JournalEntry" ? "!journal!" : "!items!") + next.id;
      data.flags.cypherFoundry.crd.logicalId = next.logicalId;
      if (row.language === "fr") data.flags.cypherFoundry.crd.sourceLogicalId = next.logicalId;
      if (row.family === "foci") {
        for (const edge of data.system?.flowchart?.edges ?? []) {
          for (const endpoint of ["from", "to"]) {
            const target = abilityIds.get("abilities-" + row.language + ":" + edge[endpoint]);
            if (!target) throw new Error("Unresolved Focus edge " + endpoint + ": " + row.file);
            edge[endpoint] = target;
          }
        }
      }
    }
    row.data = rewriteCompendiumLinks(data, UUIDs);
  }

  // Re-assert uniqueness after document and Folder IDs share a pack namespace.
  const keys = new Set();
  for (const row of rows) {
    const key = row.pack + ":" + row.data._key;
    if (keys.has(key)) throw new Error("Duplicate compiler _key: " + key);
    keys.add(key);
  }
  for (const row of rows) {
    await fs.writeFile(row.file, JSON.stringify(row.data, null, 2) + "\n");
  }
  return { documents: pairs.size * 2, pairs: pairs.size, folders: folders.size * 2,
    uuidMappings: UUIDs.size, abilityMappings: abilityIds.size };
}
