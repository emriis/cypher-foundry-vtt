/**
 * Foundry-aware equipment operations.
 *
 * Sheets collect the user's intent; this module enforces equipment invariants.
 */

/**
 * Toggle an item's equipped state.
 *
 * Only one armor item can be equipped at a time.
 *
 * @param {Item} item Item being toggled.
 * @returns {Promise<boolean>} Whether the item was updated.
 */
export async function toggleEquipped(item) {
  if (!item?.actor) return false;

  const newState = !item.system.equipped;
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
