/** CRD / Actions and Initiative: adapt the standard tracker to Cypher task costs and scores. */
import { rollTask } from "./task-service.mjs";
import { resolveNpcInitiative } from "../rules/initiative.mjs";
import { persistInitiative } from "./initiative-history.mjs";
import { ACTION_CONTEXT, runActorActions } from "./action-guard.mjs";

/** Roll NPC Actor types, including when a GM owns PCs without an assigned player. */
export function rollNpcInitiative(combat, options = {}) {
  const ids = Array.from(combat.combatants.values())
    .filter(entry => entry.actor?.type === "npc" && entry.isOwner !== false && entry.initiative === null)
    .map(entry => entry.id);
  return rollCombatInitiative(combat, ids, options);
}

/**
 * Roll selected owned PCs with fresh pre-roll choices; assign NPC target numbers.
 * Closing one PC's chooser skips that PC without costs or dice. Earlier completed
 * combatants remain persisted if a later one fails. Preserve synthetic Actors.
 * @param {Combat} combat Encounter receiving initiatives.
 * @param {string|string[]} ids Combatant IDs, as accepted by core rollInitiative.
 * @param {object} [options={}] Optional chooser, message visibility and updateTurn.
 * @returns {Promise<Combat>} Encounter, including rejected/no-op selections.
 */
export async function rollCombatInitiative(combat, ids, { chooseOptions = null, updateTurn = true, messageMode = null, formula = null } = {}) {
  if (formula && formula !== "1d20") return combat;
  if (!Array.isArray(ids) && typeof ids !== "string") return combat;
  await runActorActions([combat], "initiativeBatch", async context => {
    for (const id of new Set(typeof ids === "string" ? [ids] : ids)) {
      const combatant = combat.combatants.get(id), actor = combatant?.actor;
      if (!combatant || combatant.isOwner === false || !actor || actor.isOwner === false) continue;
      if (actor.type === "npc") {
        const score = resolveNpcInitiative(actor.system.level);
        if (score !== null) await persistInitiative({ combat, combatant }, score, { rollId: crypto.randomUUID(), updateTurn });
      } else if (actor.type === "pc") {
        const choices = chooseOptions ? await chooseOptions(actor) : {};
        if (!choices) continue;
        await rollTask(actor, { ...choices, stat: "speed", difficulty: 0,
          initiative: { combatUuid: combat.uuid, combatantId: id, rollId: crypto.randomUUID(), updateTurn,
            messageMode: messageMode ?? (combatant.hidden ? "gm" : null) },
          [ACTION_CONTEXT]: context });
      }
    }
  });
  return combat;
}
