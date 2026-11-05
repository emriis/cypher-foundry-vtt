/** Read-only library discovery and opt-in personal shortcut creation.
 * Canonical logical IDs survive source normalization; localized names never
 * select documents. Only a clicked reference loads a full compendium document.
 */
import { runActorActions } from "./action-guard.mjs";

const references = Object.freeze([
  ["task-difficulty", "rules", "JournalEntry"],
  ["effort-edge", "rules", "JournalEntry"],
  ["recoveries-healing", "rules", "JournalEntry"],
  ["distance-movement", "rules", "JournalEntry"],
  ["combat", "rules", "JournalEntry"],
  ["task-resolution", "rules", "JournalEntry"],
  ["xp-advancement", "rules", "JournalEntry"],
  ["athletics", "skills", "Item"]
].map(([key, family, documentName]) => Object.freeze({ key, family, documentName,
  logicalId: `${family === "rules" ? "journal" : "skill"}.${key}` })));
const homeCommand = "await game.cypher.library.open();";

/** Index just the two pilot families, once each per call; missing/hidden packs
 * produce disabled destinations, never a fallback into another language.
 * @param {string} language Explicit content language, independent of UI locale.
 * @returns {Promise<object[]>} Allowlisted destinations, with null UUID if unavailable.
 */
export async function libraryIndex(language) {
  if (!["en", "fr"].includes(language)) return [];
  const families = await Promise.all(["rules", "skills"].map(async family => {
    const pack = game.packs.get(`cypher.${family}-${language}`);
    if (!pack?.visible) return [family, null];
    const index = await pack.getIndex({ fields: ["flags.cypherFoundry.crd.logicalId", "flags.cypherFoundry.crd.sourceLogicalId", "type"] });
    return [family, { pack, rows: Array.from(index.values()) }];
  }));
  const indexed = new Map(families);
  return references.map(reference => {
    const source = indexed.get(reference.family);
    const matches = source?.rows.filter(row => {
      const crd = row.flags?.cypherFoundry?.crd;
      return (crd?.sourceLogicalId ?? crd?.logicalId) === reference.logicalId;
    }) ?? [];
    const row = matches.length === 1 ? matches[0] : null;
    const available = row && source.pack.documentName === reference.documentName
      && (reference.documentName !== "Item" || row.type === "skill");
    return { ...reference, name: row?.name ?? null, uuid: available
      ? `Compendium.${source.pack.collection}.${reference.documentName}.${row._id}` : null,
    id: available ? row._id : null, pack: available ? source.pack.collection : null };
  });
}

/** Revalidate visibility, canonical identity, document type and read permission
 * at the moment of opening; a stale UI link cannot grant access.
 * @returns {Promise<object|null>} Actual document, never an imported copy.
 */
export async function libraryDocument(key, language) {
  if (!references.some(reference => reference.key === key)) return null;
  const reference = (await libraryIndex(language)).find(reference => reference.key === key);
  if (!reference?.uuid) return null;
  const pack = game.packs.get(reference.pack);
  if (!pack?.visible) return null;
  const document = await pack.getDocument(reference.id);
  if (document?.documentName !== reference.documentName
    || (reference.documentName === "Item" && document.type !== "skill")
    || !document.testUserPermission(game.user, "OBSERVER")) return null;
  return document;
}

/** Actual selectable PCs; controlled synthetic Actors stay distinct from their
 * base Actor. Callers must collect an explicit choice before any task cost.
 */
export function libraryActors() {
  const actors = [...(globalThis.canvas?.tokens?.controlled ?? []).map(token => token.actor),
    game.user.character, ...game.actors];
  return [...new Map(actors.filter(actor => actor?.type === "pc" && actor.isOwner === true)
    .map(actor => [actor.uuid, actor])).values()];
}

/** Script permission is separate from permission to create world Macros. */
export function canCreateLibraryShortcut() {
  const MacroClass = foundry.documents.Macro.implementation;
  return MacroClass.canUserCreate(game.user) && game.user.hasPermission("MACRO_SCRIPT");
}

/** Create/reuse only this user's unmodified home command. Never overwrite
 * customized macros, alter the hotbar or create documents merely on opening.
 * Client-local serialization rejects double clicks during creation.
 * @returns {Promise<object|null>} Created/existing Macro, or null on rejection.
 */
export async function createLibraryShortcut() {
  if (!canCreateLibraryShortcut()) return null;
  return runActorActions([game.user], "libraryShortcut", async () => {
    if (!canCreateLibraryShortcut()) return null;
    const existing = game.macros.find(macro => macro.isAuthor && macro.isOwner
      && macro.flags?.cypher?.libraryShortcut === 1 && macro.type === "script" && macro.command === homeCommand);
    if (existing) return existing;
    return foundry.documents.Macro.implementation.create({
      name: game.i18n.localize("CYPHER.Library.Title"), type: "script",
      img: "icons/svg/book.svg", command: homeCommand,
      flags: { cypher: { libraryShortcut: 1 } }
    });
  });
}
