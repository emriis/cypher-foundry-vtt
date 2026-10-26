/** CRD common cypher rules: custody, capacity and activation timing, independent of descriptive power effects. */
import { isCarriedCypher, cypherCapacity } from "../rules/cyphers.mjs";
import { runActorActions } from "./action-guard.mjs";
import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";

const itemsOf = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);
const custody = item => item.flags?.cypher?.custody ?? "carried";
const owned = item => item?.type === "cypher" && item.actor?.type === "pc" && item.actor.isOwner !== false
  && item.isOwner !== false && item.actor.items?.get?.(item.id) === item;
const warn = key => globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.localize(`CYPHER.CypherLife.${key}`) ?? key);

/** Only held, unspent Items can activate; unresolved Power Boost form is a GM choice, not a name inference. */
export function canActivateCypher(item) {
  return owned(item) && !item.system.depleted && custody(item) === "carried" && ["subtle", "manifest"].includes(item.system.cypherType);
}

/** Read the actual inventory; old over-limit inventories remain visible without deleting anything. */
export function cypherInventoryDisplay(actor) {
  const items = itemsOf(actor).filter(item => item.type === "cypher");
  const count = items.filter(isCarriedCypher).length;
  return { count, limit: actor.system.cypherLimit, overLimit: count > actor.system.cypherLimit,
    pendingAwards: Object.entries(actor.flags?.cypher?.acquisitions ?? {}).filter(([, entry]) => entry?.version === 1 && ["pending", "manual"].includes(entry.state)).map(([id]) => ({ id })),
    items: items.map(item => ({ id: item.id, name: item.name, system: item.system,
      typeLabel: `CYPHER.CypherLife.${item.system.cypherType || "unset"}`, powerLabel: item.system.powerLevel ? `CYPHER.CypherLife.${item.system.powerLevel}` : null,
      canReconcile: game.user?.isGM && custody(item) === "transferring",
      custody: custody(item), custodyLabel: `CYPHER.CypherLife.${custody(item)}`,
      canUse: canActivateCypher(item), canDiscard: isCarriedCypher(item) && custody(item) === "carried",
      canStash: canActivateCypher(item) && item.system.cypherType === "manifest", canRetrieve: !item.system.depleted && custody(item) === "stashed",
      canTransfer: canActivateCypher(item) && item.system.cypherType === "manifest", canSetForm: game.user?.isGM && item.system.cypherCategory === "powerBoost" && !item.system.cypherType })) };
}

/** Capacity preflight also belongs in callers that spend resources before creating an Item, such as projects. */
export function canAcquireCyphers(actor, incoming = 1) { return cypherCapacity(itemsOf(actor), actor.system.cypherLimit, incoming); }

/** Final Foundry batch preflight: creations from drop/import/macro cannot each see the same free slot. */
export function validateCypherCreation(documents, parent = null) {
  const owners = new Map();
  for (const document of documents) {
    const actor = document.actor ?? parent;
    if (document.type === "cypher" && custody(document) === "stashed" && document.system.cypherType !== "manifest") { warn("physicalOnly"); return false; }
    if (actor?.type !== "pc" || !isCarriedCypher(document)) continue;
    owners.set(actor, (owners.get(actor) ?? 0) + 1);
  }
  for (const [actor, amount] of owners) if (!canAcquireCyphers(actor, amount)) { warn("capacity"); return false; }
  return true;
}

/** Initial Actor imports also validate inline inventory; loading old world Actors never calls this creation hook. */
export function validateActorCyphers(actors) {
  return actors.every(actor => actor.type !== "pc" || canAcquireCyphers(actor, 0));
}

/** Native trash deletion of live cyphers is also a discard action, including multi-delete batches. */
export async function validateCypherDeletion(documents) {
  if (documents.some(item => isCarriedCypher(item) && item.actor?.type === "pc" && !owned(item))) return false;
  const owners = [...new Set(documents.filter(isCarriedCypher).map(item => item.actor).filter(actor => actor?.type === "pc"))];
  const contexts = owners.map(actor => roundActionContext(actor, { actionTiming: "action" }));
  if (contexts.some(context => context && !context.kind)) return false;
  return Boolean(await runActorActions([...owners, ...contexts.map(context => context?.combat)], "cypherDelete", async actionContext => {
    for (const context of contexts) if (!await consumeRoundAction(context, actionContext)) return false;
    return true;
  })) || !owners.length;
}

/** Model only fields affecting custody/capacity; support dotted and expanded Foundry update forms. */
export function validateCypherUpdates(documents, updates) {
  const owners = new Set(documents.map(item => item.actor).filter(actor => actor?.type === "pc"));
  for (const actor of owners) {
    const before = itemsOf(actor), after = before.map(item => {
      const change = updates.find(change => change._id === item.id);
      if (!change) return item;
      const nextCustody = change["flags.cypher.custody"] ?? change.flags?.cypher?.custody ?? custody(item);
      const type = change["system.cypherType"] ?? change.system?.cypherType ?? item.system.cypherType;
      const next = { type: item.type, system: { depleted: change["system.depleted"] ?? change.system?.depleted ?? item.system.depleted },
        flags: { cypher: { custody: nextCustody } } };
      if (nextCustody === "stashed" && type !== "manifest") return null;
      if (item.type === "cypher" && item.system.cypherCategory === "powerBoost" && type !== item.system.cypherType && !game.user?.isGM) return null;
      return next;
    });
    if (after.includes(null)) { warn("unavailable"); return false; }
    if (after.filter(isCarriedCypher).length > Math.max(actor.system.cypherLimit, before.filter(isCarriedCypher).length)) { warn("capacity"); return false; }
  }
  return true;
}

/**
 * Reserve actual owner/Item and spend an action only for manifest activation.
 * Callers supply read-only validation before timing/cost writes. Power effects
 * remain outside this lifecycle contract; successful callbacks deplete once.
 */
export async function runCypherActivation(item, execute, preflight = () => true) {
  if (!canActivateCypher(item)) { warn("unavailable"); return false; }
  const actor = item.actor, context = item.system.cypherType === "manifest" ? roundActionContext(actor, { actionTiming: "action" }) : null;
  return (await runActorActions([actor, item, context?.combat], "cypherUse", async actionContext => {
    if (!canActivateCypher(item) || !await preflight() || context && !context.kind) return false;
    if (!await consumeRoundAction(context, actionContext)) return false;
    return execute();
  })) ?? false;
}

/** One action discards any number of selected carried cyphers. Cancelled/invalid selections spend nothing. */
export async function discardCyphers(actor, ids, { confirmed = false } = {}) {
  if (actor?.type !== "pc" || actor.isOwner === false || confirmed !== true || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return false;
  const items = ids.map(id => actor.items.get(id));
  if (items.some(item => !owned(item) || !isCarriedCypher(item) || custody(item) !== "carried")) return false;
  const context = roundActionContext(actor, { actionTiming: "action" });
  return Boolean(await runActorActions([actor, ...items, context?.combat], "cypherDiscard", async actionContext => {
    if (items.some(item => !owned(item) || !isCarriedCypher(item)) || context && !context.kind) return false;
    if (!await consumeRoundAction(context, actionContext)) return false;
    await actor.updateEmbeddedDocuments("Item", ids.map(_id => ({ _id, "flags.cypher.custody": "discarded" })));
    return true;
  }));
}

/** Stowing/retrieval requires an explicit location declaration; no distance or unstated action cost is invented. */
export async function setCypherStash(item, { stashed, location = "", confirmed = false } = {}) {
  if (!owned(item) || item.system.depleted || item.system.cypherType !== "manifest" || confirmed !== true || typeof stashed !== "boolean"
    || stashed && (!location.trim() || custody(item) !== "carried") || !stashed && custody(item) !== "stashed") return false;
  return Boolean(await runActorActions([item.actor, item], "cypherCustody", async () => {
    if (!stashed && !canAcquireCyphers(item.actor)) return false;
    await item.update({ "flags.cypher.custody": stashed ? "stashed" : "carried", "flags.cypher.stashLocation": stashed ? location.trim() : "" });
    return true;
  }));
}

/** Power Boost form determines timing and transferability; its unspecified source effect level is preserved. */
export async function setCypherForm(item, type) {
  if (!game.user?.isGM || !owned(item) || item.system.cypherCategory !== "powerBoost" || item.system.depleted || !["subtle", "manifest"].includes(type)) return false;
  return Boolean(await runActorActions([item.actor, item], "cypherForm", async () => {
    await item.update({ "system.cypherType": type }); return true;
  }));
}

/**
 * Physical transfer uses a durable source checkpoint. An interrupted creation
 * never retries blindly; the GM must inspect destination/source before resolving.
 * Both actual actors must be writable by the caller, including synthetic owners.
 */
export async function transferCypher(item, destination, { confirmed = false } = {}) {
  if (!canActivateCypher(item) || item.system.cypherType !== "manifest" || destination?.type !== "pc"
    || destination.isOwner === false || destination === item.actor || destination.uuid === item.actor.uuid || confirmed !== true) return false;
  return Boolean(await runActorActions([item, item.actor, destination], "cypherTransfer", async () => {
    if (!canActivateCypher(item) || !canAcquireCyphers(destination)) return false;
    const data = item.toObject(); delete data._id;
    data.flags ??= {}; data.flags.cypher = { ...data.flags.cypher, custody: "carried", transferredFrom: item.uuid };
    await item.update({ "flags.cypher.custody": "transferring", "flags.cypher.transferDestination": destination.uuid });
    const [created] = await destination.createEmbeddedDocuments("Item", [data]);
    if (!created) throw Error("Cypher transfer creation was rejected");
    await item.update({ "flags.cypher.custody": "transferred", "flags.cypher.transferResult": created.uuid });
    return true;
  }));
}

/** Record an explicit GM correction after inspecting an uncertain transfer; never create/delete another Item here. */
export async function reconcileCypherTransfer(item, { transferred, note = "" } = {}) {
  if (!game.user?.isGM || !owned(item) || custody(item) !== "transferring" || typeof transferred !== "boolean" || !note.trim()) return false;
  return Boolean(await runActorActions([item.actor, item], "cypherReconcile", async () => {
    if (custody(item) !== "transferring") return false;
    await item.update({ "flags.cypher.custody": transferred ? "transferred" : "carried", "flags.cypher.transferReconciliation": note });
    return true;
  }));
}
