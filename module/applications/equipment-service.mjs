/**
 * Foundry-aware equipment operations.
 *
 * Sheets collect the user's intent; this module enforces equipment invariants.
 */
import { canShieldAbsorbWound, isShieldBroken } from "../rules/wounds.mjs";
import { runActorAction } from "./action-guard.mjs";
import { shieldSurvivesMajor, shieldOwnerItems } from "../rules/shield-abilities.mjs";

/**
 * Expose current shield choices to sheets without putting eligibility rules in UI.
 * @param {Actor} actor Actual owner, including a synthetic token Actor.
 * @returns {Item[]} Equipped, intact shield Items available for an explicit Block choice.
 */
export function getAvailableShields(actor) {
  const items = actor.items?.contents ?? (Array.isArray(actor.items) ? actor.items : Array.from(actor.items?.values?.() ?? []));
  return items.filter(canShieldAbsorbWound);
}

/**
 * Toggle an item's equipped state.
 *
 * Only one armor item can be equipped at a time.
 *
 * @param {Item} item Item being toggled.
 * @returns {Promise<boolean>} Whether the item was updated.
 */
export async function toggleEquipped(item) {
  if (!item?.actor || item.actor.isOwner === false || item.isOwner === false) return false;
  return Boolean(await runActorAction(item.actor, "equipment", () => toggleOwnedEquipment(item)));
}

/** Keep equipment changes outside another pending task on the same owner. */
async function toggleOwnedEquipment(item) {
  const newState = !item.system.equipped;
  if (newState && item.type === "shield" && (item.system.inHand === false
    || isShieldBroken(item.system.wounds, shieldSurvivesMajor(item, shieldOwnerItems(item))))) return false;
  if (item.type === "armor" && newState) {
    const others = item.actor.items.filter(
      candidate =>
        candidate.type === "armor"
        && candidate.id !== item.id
        && candidate.system.equipped
    );

    if (others.length) {
      await item.actor.updateEmbeddedDocuments(
        "Item",
        others.map(candidate => ({
          _id: candidate.id,
          "system.equipped": false
        }))
      );
    }
  }

  await item.update({ "system.equipped": newState });
  return true;
}

/**
 * Enforce the single-equipped-armor invariant after an Item update.
 *
 * @param {Item} item Armor Item that was equipped.
 * @returns {Promise<void>} Completes after conflicting armor is unequipped.
 */
export async function enforceSingleEquippedArmor(item) {
  if (item?.type !== "armor" || !item.actor || !item.system.equipped) return;

  const others = item.actor.items.filter(
    candidate =>
      candidate.type === "armor"
      && candidate.id !== item.id
      && candidate.system.equipped
  );

  if (others.length) {
    await item.actor.updateEmbeddedDocuments(
      "Item",
      others.map(candidate => ({
        _id: candidate.id,
        "system.equipped": false
      }))
    );
  }
}
