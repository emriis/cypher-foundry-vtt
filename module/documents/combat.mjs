/** Thin Foundry tracker adapter; Cypher initiative rules and writes live in application services. */
import { rollCombatInitiative, rollNpcInitiative } from "../applications/combat-service.mjs";
import { compareInitiative } from "../rules/initiative.mjs";
import { beginCombatRound, advanceCombatRound, rewindCombatRound, getRoundFlow } from "../applications/round-flow-service.mjs";

export default class CypherCombat extends foundry.documents.Combat {
  /** Execute a CRD queue while retaining the core Combatant documents and initiative scores. */
  async startCombat() { return this.started ? this : beginCombatRound(this, 1); }

  /** The tracker advances execution slots, including follow-ups, rather than raw initiative indices. */
  async nextTurn() { return advanceCombatRound(this); }

  /** Explicit round advancement discards unused waits and restores normal ordering. */
  async nextRound() { return beginCombatRound(this, this.round + 1); }

  /** Rewinding does not refund action costs or repeat an expiration boundary. */
  async previousTurn() { return getRoundFlow(this) ? rewindCombatRound(this) : super.previousTurn(); }

  /** Revisit the recorded queue without manufacturing a new past action. */
  async previousRound() { return getRoundFlow(this) ? rewindCombatRound(this, { previousRound: true }) : super.previousRound(); }
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
