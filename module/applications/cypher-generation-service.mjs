/** Source-backed weighted generation and explicit GM awards. Generation is not activation and never depletes a source. */
import { resolveCypherGeneration } from "../rules/cyphers.mjs";
import { canAcquireCyphers } from "./cypher-inventory-service.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { runActorActions } from "./action-guard.mjs";

const authority = () => game.user?.isGM === true && game.users?.activeGM?.id === game.user.id;
const owned = actor => actor?.type === "pc" && actor.isOwner !== false;

/** Read canonical identity across both language families; translated names never select mechanics. */
export async function cypherSourceChoices(language = "en") {
  const pack = ["en", "fr"].includes(language) ? game.packs?.get(`cypher.equipment-${language}`) : null;
  if (!pack) return [];
  const index = await pack.getIndex({ fields: ["type", "flags.cypherFoundry.crd.logicalId", "flags.cypherFoundry.crd.sourceLogicalId"] });
  return index.filter(entry => entry.type === "cypher").map(entry => ({
    name: entry.name, uuid: `Compendium.${pack.collection}.Item.${entry._id}`,
    logicalId: entry.flags?.cypherFoundry?.crd?.sourceLogicalId ?? entry.flags?.cypherFoundry?.crd?.logicalId
  }));
}

/** Draw exact CRD tables and return an offer. No inventory, capacity, action or depletion is mutated. */
export async function drawCypher(table, { language = "en", superheroConfirmed = false } = {}) {
  if (!authority() || !["subtle", "manifest", "superhero"].includes(table) || table === "superhero" && superheroConfirmed !== true) return null;
  const sources = await cypherSourceChoices(language);
  if (!sources.length) return null;
  const rolls = [];
  const draw = async table => {
    const roll = await new Roll("1d100").evaluate();
    rolls.push({ table, value: roll.total });
    return resolveCypherGeneration(table, roll.total);
  };
  let selection = await draw(table);
  if (table === "manifest") selection = selection && await draw(selection.power);
  if (selection?.redirect) selection = await draw(selection.redirect);
  if (!selection?.logicalId) return null;
  const matches = sources.filter(source => source.logicalId === selection.logicalId);
  if (matches.length !== 1) return null;
  const [source] = matches;
  return { ...source, power: selection.power ?? null, rolls };
}

/** Clone only actual Item source data, optionally fixing a structured variant by its power enum. */
export function acquiredCypherData(source, { power = null, form = null } = {}) {
  if (source?.type !== "cypher") return null;
  const raw = source.toObject();
  const data = { type: "cypher", name: raw.name, img: raw.img, system: structuredClone(raw.system), flags: structuredClone(raw.flags ?? {}) };
  data.flags.cypher = { ...data.flags.cypher, custody: "carried", sourceUuid: source.uuid };
  delete data.flags.cypher.transferDestination; delete data.flags.cypher.transferResult;
  data.system.depleted = false;
  if (data.system.cypherCategory === "powerBoost") {
    if (!["subtle", "manifest"].includes(form)) return null;
    data.system.cypherType = form;
  }
  if (!["subtle", "manifest"].includes(data.system.cypherType)) return null;
  if (power) {
    if (!(data.system.powerLevels?.length ? data.system.powerLevels : [data.system.powerLevel]).includes(power)) return null;
    if (data.system.variants?.length) {
      const variants = data.system.variants.filter(variant => variant.powerLevel === power);
      if (variants.length !== 1) return null;
      data.name += ` (${variants[0].name})`;
      data.flags.cypher.fixedVariant = variants[0].name;
      data.system.variants = [];
    }
    data.system.powerLevel = power; data.system.powerLevels = [power];
  }
  return data;
}

/**
 * Confirm a chosen or generated offer. A durable pending checkpoint prevents
 * duplicate awards after uncertain creation/publication; sources stay unchanged.
 */
export async function acquireCypher(actor, sourceUuid, { requestId, confirmed = false, power = null, form = null, rolls = [] } = {}) {
  if (!authority() || !owned(actor) || confirmed !== true || typeof requestId !== "string" || !/^[A-Za-z0-9]+$/.test(requestId)) return false;
  const source = await resolveDocumentReference(sourceUuid, "cypher");
  const data = acquiredCypherData(source, { power, form });
  if (!data) return false;
  return Boolean(await runActorActions([actor], "cypherAward", async () => {
    const path = `flags.cypher.acquisitions.${requestId}`;
    const receipt = actor.flags?.cypher?.acquisitions?.[requestId];
    if (receipt && (receipt.sourceUuid !== sourceUuid || receipt.power !== power || (receipt.form ?? null) !== form)) return false;
    if (receipt?.state === "applied") return true;
    if (receipt) { await actor.update({ [path]: { ...receipt, state: "manual" } }); return false; }
    if (!canAcquireCyphers(actor)) return false;
    await actor.update({ [path]: { version: 1, state: "pending", sourceUuid, power, form, rolls } });
    data.flags.cypher.acquisitionId = requestId;
    const [created] = await actor.createEmbeddedDocuments("Item", [data]);
    if (!created) throw Error("Cypher acquisition was rejected");
    await actor.update({ [path]: { version: 1, state: "applied", sourceUuid, power, form, rolls, resultUuid: created.uuid } });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${game.i18n.format("CYPHER.CypherLife.awarded", {
      name: foundry.utils.escapeHTML(created.name) })}</p>` });
    return true;
  }));
}

/** After inspecting an uncertain award, the GM records the correction without creating another cypher. */
export async function reconcileCypherAward(actor, requestId, { note = "", confirmed = false } = {}) {
  if (!authority() || !owned(actor) || confirmed !== true || typeof requestId !== "string" || !/^[A-Za-z0-9]+$/.test(requestId) || !note.trim()) return false;
  const receipt = actor.flags?.cypher?.acquisitions?.[requestId];
  if (!receipt || !["pending", "manual"].includes(receipt.state)) return false;
  return Boolean(await runActorActions([actor], "cypherAwardReconcile", async () => {
    await actor.update({ [`flags.cypher.acquisitions.${requestId}`]: { ...receipt, state: "applied", reconciliation: note } });
    return true;
  }));
}
