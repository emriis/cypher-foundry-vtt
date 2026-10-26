import { useCypher, rollAttack, rollDepletion } from "../applications/item-service.mjs";
import { validateCypherCreation, validateCypherUpdates, validateCypherDeletion } from "../applications/cypher-inventory-service.mjs";

/**
 * Foundry Item document extended with Cypher-specific compatibility methods.
 * A facade keeps familiar macro calls such as item.rollAttack(), but delegates
 * gameplay to application services. Add rule calculations there, not here.
 *
 * Gameplay use cases live in application services so Item remains a stable
 * public API for sheets, macros, and other Foundry callers.
 */
export default class CypherItem extends Item {
  /** V13/V14 batch hooks delegate final acquisition/custody validation to applications. */
  static async _preCreateOperation(documents, operation, user) {
    if (await super._preCreateOperation(documents, operation, user) === false) return false;
    return validateCypherCreation(documents, operation.parent);
  }

  static async _preUpdateOperation(documents, operation, user) {
    if (await super._preUpdateOperation(documents, operation, user) === false) return false;
    return validateCypherUpdates(documents, operation.updates);
  }

  static async _preDeleteOperation(documents, operation, user) {
    if (await super._preDeleteOperation(documents, operation, user) === false) return false;
    return validateCypherDeletion(documents);
  }

  async useCypher() {
    return useCypher(this);
  }

  async rollAttack(options = {}) {
    return rollAttack(this, options);
  }

  async rollDepletion() {
    return rollDepletion(this);
  }
}
