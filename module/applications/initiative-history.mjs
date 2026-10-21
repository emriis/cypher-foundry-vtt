/** Resolve and persist initiative against the original Combatant, never a world Actor ID. */
import { resolveDocumentReference } from "./reference-resolver.mjs";

/** Bridge the renamed core roll visibility option without changing the saved mode. */
export function initiativeMessageOptions(initiative) {
  if (!initiative.messageMode) return {};
  return (globalThis.game?.release?.generation ?? 14) >= 14 ? { messageMode: initiative.messageMode }
    : { rollMode: ({ public: "publicroll", gm: "gmroll", blind: "blindroll", self: "selfroll" })[initiative.messageMode] ?? initiative.messageMode };
}

/** Validate membership and ownership before any Pool or XP expenditure. */
export async function resolveInitiativeOwner(initiative, actor, { reroll = false } = {}) {
  if (!initiative || typeof initiative.combatUuid !== "string" || typeof initiative.combatantId !== "string"
    || typeof initiative.rollId !== "string") return null;
  const combat = await resolveDocumentReference(initiative.combatUuid);
  const combatant = combat?.combatants?.get(initiative.combatantId);
  if (!combatant || combatant.actor !== actor || combatant.isOwner === false || actor?.isOwner === false
    || reroll && (combatant.flags?.cypher?.initiativeRollId !== initiative.rollId
      || initiative.state === "applied" && combatant.initiative !== initiative.score)) return null;
  return { combat, combatant };
}

/**
 * Persist score and roll identity together. Core maintains the active combatant
 * across the reorder; suppress turn events because editing initiative is not
 * taking a new turn. The Cypher hook also recognizes this operation context.
 * @param {object} owner Actual Combat and Combatant.
 * @param {number} score Resolved initiative points, including negative scores.
 * @param {object} initiative Persisted roll ID and optional updateTurn preference.
 */
export async function persistInitiative({ combat, combatant }, score, initiative) {
  await combat.updateEmbeddedDocuments("Combatant", [{ _id: combatant.id, initiative: score,
    "flags.cypher.initiativeRollId": initiative.rollId }], { turnEvents: false, cypherInitiativeReorder: true,
    ...(initiative.updateTurn === false ? { combatTurn: combat.turn } : {}) });
}
