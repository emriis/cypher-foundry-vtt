import { CYPHER } from "../config.mjs";

/**
 * Spend XP at the application boundary.
 *
 * Keeping this operation outside the Actor document makes XP spending reusable
 * by task rolls, rerolls, intrusions, and future application use cases.
 *
 * @param {Actor} actor Character spending XP.
 * @param {number} amount Number of XP to spend.
 * @param {string} [reasonLabel=""] Localized reason shown in the warning.
 * @returns {Promise<boolean>} True when the XP was successfully spent.
 */
export async function spendXP(actor, amount, reasonLabel = "") {
  if (actor.type !== "pc") return false;

  const currentXP = actor.system.xp ?? 0;
  if (currentXP < amount) {
    ui.notifications.error(
      game.i18n.format("CYPHER.Warning.NotEnoughXP", {
        amount,
        reason: reasonLabel
      })
    );
    return false;
  }

  await actor.update({ "system.xp": currentXP - amount });
  return true;
}

// Preserve the existing Actor/macro API while the reroll service owns the flow.
export { rerollMessage } from "./reroll-service.mjs";

/**
 * Apply a Player Intrusion after charging its XP cost.
 *
 * @param {Actor} actor Character using the intrusion.
 * @param {string} description Player-provided intrusion description.
 * @returns {Promise<void>} Completes after the chat message is created.
 */
export async function usePlayerIntrusion(actor, description) {
  if (!(await spendXP(
    actor,
    CYPHER.xpCosts.playerIntrusion,
    game.i18n.localize("CYPHER.XP.PlayerIntrusion")
  ))) return;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cypher-roll-card"><h3>${
      game.i18n.localize("CYPHER.XP.PlayerIntrusion")
    }</h3><p>${description || ""}</p></div>`
  });
}


/**
 * Add a custom character stat.
 *
 * This is intentionally kept as a small application operation: the sheet
 * collects the label, while this service validates and persists the change.
 *
 * @param {Actor} actor PC receiving the custom stat.
 * @param {string} label Display label for the stat.
 * @returns {Promise<void>} Completes after the stat is stored.
 */
export async function addCustomStat(actor, label) {
  if (actor.type !== "pc" || !label?.trim()) return;

  const id = label.trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    || `stat-${foundry.utils.randomID(6)}`;

  if (
    CYPHER.stats.includes(id)
    || actor.system.customStats.some(stat => stat.id === id)
  ) {
    ui.notifications.warn(
      game.i18n.localize("CYPHER.Warning.CustomStatExists")
    );
    return;
  }

  const customStats = actor.system.customStats.map(stat => ({ ...stat }));
  customStats.push({
    id,
    label: label.trim(),
    pool: { max: 8, value: 8 },
    edge: 0
  });

  await actor.update({ "system.customStats": customStats });
}

/**
 * Remove a custom character stat by id.
 *
 * @param {Actor} actor PC owning the stat.
 * @param {string} id Custom stat identifier.
 * @returns {Promise<void>} Completes after the stat is removed.
 */
export async function deleteCustomStat(actor, id) {
  if (actor.type !== "pc") return;

  const customStats = actor.system.customStats.filter(stat => stat.id !== id);
  await actor.update({ "system.customStats": customStats });
}

/**
 * Add a custom character field.
 *
 * @param {Actor} actor PC receiving the field.
 * @param {string} label Display label for the field.
 * @param {string} [fieldType="text"] Field value type.
 * @returns {Promise<void>} Completes after the field is stored.
 */
export async function addCustomField(actor, label, fieldType = "text") {
  if (actor.type !== "pc" || !label?.trim()) return;
  if (!CYPHER.customFieldTypes.includes(fieldType)) fieldType = "text";

  const id = `field-${foundry.utils.randomID(8)}`;
  const customFields = actor.system.customFields.map(field => ({ ...field }));

  customFields.push({
    id,
    label: label.trim(),
    fieldType,
    valueText: "",
    valueNumber: 0,
    valueBoolean: false
  });

  await actor.update({ "system.customFields": customFields });
}

/**
 * Remove a custom character field by id.
 *
 * @param {Actor} actor PC owning the field.
 * @param {string} id Custom field identifier.
 * @returns {Promise<void>} Completes after the field is removed.
 */
export async function deleteCustomField(actor, id) {
  if (actor.type !== "pc") return;

  const customFields = actor.system.customFields.filter(field => field.id !== id);
  await actor.update({ "system.customFields": customFields });
}

/**
 * Toggle the optional second Descriptor.
 *
 * @param {Actor} actor PC Actor.
 * @param {boolean} enabled Whether the second Descriptor should be enabled.
 * @returns {Promise<void>} Completes after the actor is updated.
 */
export async function toggleSecondDescriptor(actor, enabled) {
  if (actor.type !== "pc") return;

  await actor.update(
    enabled
      ? { "system.hasSecondDescriptor": true }
      : {
          "system.hasSecondDescriptor": false,
          "system.descriptor2": ""
        }
  );
}

/**
 * Toggle the optional second Focus.
 *
 * @param {Actor} actor PC Actor.
 * @param {boolean} enabled Whether the second Focus should be enabled.
 * @returns {Promise<void>} Completes after the actor is updated.
 */
export async function toggleSecondFocus(actor, enabled) {
  if (actor.type !== "pc") return;

  await actor.update(
    enabled
      ? { "system.hasSecondFocus": true }
      : {
          "system.hasSecondFocus": false,
          "system.focus2": ""
        }
  );
}
