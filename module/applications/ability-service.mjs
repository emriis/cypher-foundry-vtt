import { activateAbilityEffect } from "./ability-runtime-service.mjs";

/**
 * Foundry-aware application operations for interactive Ability content.
 *
 * The PC sheet owns dialogs and input collection. This service owns the
 * resulting game operation: resolving an effect, enriching its text, rolling
 * an ability table, and posting the result to chat.
 */

/**
 * Resolve and announce a selected Ability effect.
 *
 * @param {Item} item Ability Item.
 * @param {string} effectId Selected effect identifier.
 * @returns {Promise<boolean>} Whether an effect was posted.
 */
export async function chooseAbilityEffect(item, effectId) {
  if (!item || item.type !== "ability") return false;

  const effect = (item.system.effects ?? [])
    .find(candidate => candidate.id === effectId);
  if (!effect) return false;

  const actor = item.actor;
  const isOngoing = (effect.endConditions ?? []).length > 0;
  if (isOngoing && actor?.type === "pc" && item.parent === actor) {
    const activated = await activateAbilityEffect(actor, item, effectId);
    if (!activated) return false;
  }

  const description =
    await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      effect.description ?? "",
      { relativeTo: item }
    );
  const effort = effect.effort
    ? `<p><strong>${game.i18n.localize(
        "CYPHER.Ability.Effort"
      )}:</strong> ${effect.effort}</p>`
    : "";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    content: `<div class="cypher-roll-card"><h3>${item.name}: ${effect.name}</h3>${description}${effort}</div>`
  });
  return true;
}

/**
 * Roll an Ability table and post the matching result to chat.
 *
 * @param {Item} item Ability Item.
 * @param {string} tableId Ability table identifier.
 * @returns {Promise<boolean>} Whether the table was rolled.
 */
export async function rollAbilityTable(item, tableId) {
  if (!item || item.type !== "ability") return false;

  const table = (item.system.rollTables ?? [])
    .find(candidate => candidate.id === tableId);
  if (!table) return false;

  let roll;
  try {
    roll = await new Roll(table.formula).evaluate();
  } catch (error) {
    ui.notifications.error(
      `${game.i18n.localize("CYPHER.Ability.InvalidRollTable")}: ${error.message}`
    );
    return false;
  }

  const result = table.results.find(
    candidate => roll.total >= candidate.min && roll.total <= candidate.max
  );
  const description = result
    ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        result.description ?? "",
        { relativeTo: item }
      )
    : `<p>${game.i18n.localize("CYPHER.Ability.NoRollTableResult")}</p>`;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    flavor: `<strong>${item.name}</strong> — ${table.name}<br>${description}`
  });
  return true;
}
