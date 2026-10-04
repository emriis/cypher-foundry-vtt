import { useCypher, rollAttack, rollDepletion } from "../applications/item-service.mjs";

/**
 * Foundry Item document extended with Cypher-specific compatibility methods.
 *
 * Gameplay use cases live in application services so Item remains a stable
 * public API for sheets, macros, and other Foundry callers.
 */
export default class CypherItem extends Item {
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
