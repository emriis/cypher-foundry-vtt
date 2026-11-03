/** Read-only protection projections for ordinary damage, task preflight and sheets. */
import { PROTECTION_KEYS, protectionPlan, protectionEnergy, elementalReduction } from "../rules/protection-powers.mjs";
import { resolveCachedDocumentReference } from "./reference-resolver.mjs";
import { awesomePersonalActive, awesomeDisplay } from "./awesome-field-read.mjs";
export const protectionUses = actor => Object.values(actor?.flags?.cypher?.protectionUses ?? {}).filter(use => use?.version === 1);

/** A pending batch grants no benefits; a retained receipt can never renew an expired recovery interval. */
export function liveProtections(actor) {
  return Object.values(actor?.flags?.cypher?.protections ?? {}).flatMap(receipt => {
    if (receipt?.version !== 1 || receipt.state !== "active") return [];
    const owner = receipt.ownerUuid === actor.uuid ? actor : resolveCachedDocumentReference(receipt.ownerUuid);
    const use = owner?.flags?.cypher?.protectionUses?.[receipt.id];
    const rule = use && protectionPlan(use.key, use.effort);
    const target = use?.targets?.find(target => target.uuid === actor.uuid);
    return use?.version === 1 && use.id === receipt.id && use.state === "complete" && rule && use.steps === rule.steps && use.recovery === rule.recovery && target
      && receipt.revision === target.revision && receipt.revision === (actor.flags?.cypher?.protectionRecoveries?.[use.recovery] ?? 0)
      ? [{ ...use, ownerUuid: owner.uuid }] : [];
  });
}

/** Physical armor still applies to Block; Mage Armor changes its Pool only when explicitly selected. */
export function protectionBlockPlan(actor, mageArmor = false, awesomeField = false) {
  const effects = liveProtections(actor), mage = effects.some(effect => effect.key === "mage-armor");
  const awesome = awesomePersonalActive(actor);
  if (mageArmor && (!mage || awesomeField) || awesomeField && !awesome) return null;
  const intellect = mageArmor || awesomeField;
  const bonuses = new Set([...(mage ? [actor.system.tier >= 3 ? 2 : 1] : []), ...(awesome ? [1] : [])]);
  return { stat: intellect ? "intellect" : "might", ease: (intellect ? [...bonuses].reduce((sum, value) => sum + value, 0) : 0)
    + (effects.some(effect => effect.key === "armoring-debris") ? 1 : 0), mageAvailable: mage, awesomeAvailable: awesome };
}
export const protectionWoundReduction = (actor, energy = "", tags = []) => elementalReduction(liveProtections(actor), protectionEnergy(energy, tags));
export const protectionNpcReduction = (actor, energy = "", tags = []) => 3 * protectionWoundReduction(actor, energy, tags);

/** Common energy labels are localized; custom values remain explicit GM-authored mechanical categories. */
export function protectionEnergyChoices() {
  const actors = [...(game.actors?.contents ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor)];
  return [...new Set(["fire", "cold", "electricity", ...actors.flatMap(actor => protectionUses(actor).map(use => use.energy).filter(Boolean))])];
}
export function protectionDisplay(actor) {
  const display = { choices: (actor.items?.contents ?? Array.from(actor.items?.values?.() ?? [])).filter(item => item.type === "ability" && PROTECTION_KEYS.includes(item.system.key))
    .map(item => ({ id: item.id, name: item.name })), pending: protectionUses(actor).filter(use => use.state === "pending"),
    received: liveProtections(actor).map(use => ({ ...use, name: resolveCachedDocumentReference(use.ownerUuid)?.items?.get(use.itemId)?.name ?? use.sourceName ?? use.key })),
    outgoing: protectionUses(actor).filter(use => use.state === "complete").flatMap(use => use.targets.filter(target => target.uuid !== actor.uuid).map(target => {
      const npc = resolveCachedDocumentReference(target.uuid);
      return { id: use.id, uuid: target.uuid, name: npc?.name ?? target.uuid, energy: use.energy, npc: npc?.type === "npc",
        active: npc && liveProtections(npc).some(effect => effect.id === use.id) };
    })).filter(target => target.active) };
  const awesome = awesomeDisplay(actor);
  return { ...display, awesome, visible: display.choices.length + display.pending.length + display.received.length + display.outgoing.length
    + awesome.choices.length + awesome.barriers.length + awesome.containment.length > 0 || Boolean(awesome.personal) };
}
