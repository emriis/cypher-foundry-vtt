/** Thin Foundry tracker adapter; Cypher initiative rules and writes live in application services. */
import { rollCombatInitiative, rollNpcInitiative } from "../applications/combat-service.mjs";
import { compareInitiative } from "../rules/initiative.mjs";

export default class CypherCombat extends foundry.documents.Combat {
  /** Use the tracker buttons with the same pre-roll choices as a Speed task. */
  async rollInitiative(ids, options = {}) {
    return rollCombatInitiative(this, ids, {
      chooseOptions: game.cypher?.promptInitiativeOptions, ...options
    });
  }

  /** Core's player-ownership heuristic also includes GM-owned PCs; use Cypher Actor types. */
  async rollNPC(options = {}) { return rollNpcInitiative(this, options); }

  /** CRD initiative equality puts the PC before an NPC at the same score. */
  _sortCombatants(a, b) { return compareInitiative(a, b); }
}
