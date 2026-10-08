import { CYPHER } from "../config.mjs";
import {
  addCustomField,
  addCustomStat,
  deleteCustomField,
  deleteCustomStat,
  rerollMessage,
  spendXP,
  usePlayerIntrusion
} from "../applications/character-service.mjs";
import {
  addWound,
  applyDamage,
  applyNpcDamage,
  damageArmor,
  reduceWound,
  repairArmor,
  shieldAbsorbWound,
  syncWoundStatusEffects
} from "../applications/damage-service.mjs";
import { rollDefense, rollTask } from "../applications/task-service.mjs";
import { rollNpcAttack } from "../applications/npc-combat-service.mjs";
import {
  advanceTier,
  purchaseAdvancementSlot
} from "../applications/advancement-service.mjs";
import {
  rallyWound,
  rollRecovery
} from "../applications/recovery-service.mjs";
import {
  computeEffortCost
} from "../rules/tasks.mjs";
import {
  applyDescriptor,
  applyFocus,
  applyType,
  selectFocusAbility
} from "../applications/content-service.mjs";
import {
  getEligibleFocusAbilities,
  isFocusAbilityEligible
} from "../rules/focus.mjs";
import { resolveDefense } from "../rules/defense.mjs";
import { convertDamageToWound } from "../rules/wounds.mjs";

/**
 * Extends Foundry's Actor class with Cypher logic.
 *
 * Sheet actions call methods here to change actor data. Gameplay use cases are
 * delegated to application services, while this document keeps compatibility
 * facades and genuinely document-specific helpers.
 */
export default class CypherActor extends Actor {

  /* -------------------------------------------- */
  /*  Effort cost                                    */
  /* -------------------------------------------- */

  /**
   * Computes total Pool cost for a number of Effort levels.
   *
   * Kept as a compatibility facade for callers that historically used the
   * actor class directly. The rule itself lives in module/rules/tasks.mjs.
   */
  static computeEffortCost(levels, edge = 0) {
    return computeEffortCost(levels, edge);
  }

  /**
   * Determines whether one Focus ability can be selected at the character's current tier.
   * A non-tier-1 node requires at least one selected predecessor from its flowchart links.
   *
   * @param {object} focus Focus graph data.
   * @param {string[]} selectedAbilityIds Previously selected Focus ability ids.
   * @param {string} abilityId Focus ability id to evaluate.
   * @param {number} tier Character tier.
   * @returns {boolean} Whether the Focus ability can be selected.
   */
  static isFocusAbilityEligible(focus, selectedAbilityIds, abilityId, tier) {
    return isFocusAbilityEligible(focus, selectedAbilityIds, abilityId, tier);
  }

  /**
   * Lists Focus abilities currently selectable according to their flowchart links.
   *
   * @param {object} focus Focus graph data.
   * @param {string[]} selectedAbilityIds Previously selected Focus ability ids.
   * @param {number} tier Character tier.
   * @returns {object[]} Eligible Focus abilities.
   */
  static getEligibleFocusAbilities(focus, selectedAbilityIds, tier) {
    return getEligibleFocusAbilities(focus, selectedAbilityIds, tier);
  }

  /* -------------------------------------------- */
  /*  Task rolls                                  */
  /* -------------------------------------------- */

  /**
   * Rolls a Cypher task through the application service.
   *
   * The Actor method stays as a compatibility facade so existing sheets and
   * macros can keep calling the same API while the use case evolves.
   *
   * @param {object} [options={}] Roll options.
   * @returns {Promise<object|null>} Roll result or null when rejected.
   */
  async rollTask(options = {}) {
    return rollTask(this, options);
  }

  /**
   * Reduce a wound severity by one step.
   *
   * @param {string} severity Current wound severity.
   * @returns {string|null} Reduced severity, or null when the wound disappears.
   */
  _reduceWoundSeverity(severity) {
    return reduceWound(severity);
  }

  /**
   * Have a shield absorb a wound through the damage application service.
   *
   * @param {object} shieldItem Shield receiving the wound.
   * @param {string} severity Incoming wound severity.
   * @returns {Promise<void>} Completes after the shield is updated.
   */
  async _shieldAbsorbWound(shieldItem, severity) {
    return shieldAbsorbWound(this, shieldItem, severity);
  }

  /**
   * Rolls a Defense task by mapping Block/Dodge to the correct stat and
   * armor modifier before delegating to the normal task service.
   *
   * @param {string} defenseType "block" or "dodge".
   * @param {object} [options={}] Defense roll options.
   * @returns {Promise<object|null>} Roll result or null when rejected.
   */
  async rollDefense(defenseType, options = {}) {
    return rollDefense(this, defenseType, options);
  }

  /**
   * Execute a structured NPC attack against a player target.
   *
   * @param {object} attack Structured NPC attack.
   * @param {object} [options={}] Target and defense options.
   * @returns {Promise<object|null>} Defense and damage result.
   */
  async rollNpcAttack(attack, options = {}) {
    return rollNpcAttack(this, attack, options);
  }

  /* -------------------------------------------- */
  /*  Experience Points                            */
  /* -------------------------------------------- */

  /**
   * Spend XP through the character application service.
   *
   * @param {number} amount Number of XP to spend.
   * @param {string} [reasonLabel=""] Localized reason shown in the warning.
   * @returns {Promise<boolean>} Whether the XP was spent.
   */
  async spendXP(amount, reasonLabel = "") {
    return spendXP(this, amount, reasonLabel);
  }

  /**
   * Reroll a previous roll through the character application service.
   *
   * @param {object} message Foundry chat message containing reroll flags.
   * @returns {Promise<void>|undefined} Nothing when not rerollable.
   */
  async rerollMessage(message) {
    return rerollMessage(this, message);
  }

  /**
   * Compatibility facade for the depletion reroll helper.
   *
   * @param {object} message Foundry chat message.
   * @param {object} flags Legacy reroll metadata argument.
   * @returns {Promise<void>|undefined} Reroll result.
   */
  async _rerollDepletion(message, flags) {
    return rerollMessage(this, message);
  }

  /**
   * Use a Player Intrusion through the character application service.
   *
   * @param {string} description Player-provided intrusion description.
   * @returns {Promise<void>} Completes after the intrusion message is created.
   */
  async usePlayerIntrusion(description) {
    return usePlayerIntrusion(this, description);
  }

  /* -------------------------------------------- */
  /*  Character advancement                       */
  /* -------------------------------------------- */

  /**
   * Purchase an advancement slot through the advancement application service.
   *
   * @param {number} index Advancement slot index.
   * @param {object} [extra={}] User-selected advancement options.
   * @returns {Promise<void>} Completes after the purchase.
   */
  async purchaseAdvancementSlot(index, extra = {}) {
    return purchaseAdvancementSlot(this, index, extra);
  }

  /**
   * Advance the character's tier through the advancement application service.
   *
   * @returns {Promise<void>} Completes after the tier transition.
   */
  async _advanceTier() {
    return advanceTier(this);
  }

  /* -------------------------------------------- */
  /*  Recovery rolls                               */
  /* -------------------------------------------- */

  /**
   * Take a recovery through the recovery application service.
   *
   * @param {string} [interval="hour"] Recovery interval.
   * @returns {Promise<object|null>} Recovery roll.
   */
  async rollRecovery(interval = "hour") {
    return rollRecovery(this, interval);
  }

  /**
   * Rally a wound through the recovery application service.
   *
   * @param {string} severity Wound severity to rally.
   * @returns {Promise<void>} Completes after the rally.
   */
  async rallyWound(severity) {
    return rallyWound(this, severity);
  }

  /* -------------------------------------------- */
  /*  Custom character data                       */
  /* -------------------------------------------- */

  /**
   * Add a custom stat through the character application service.
   *
   * @param {string} label Display label for the stat.
   * @returns {Promise<void>} Completes after the stat is stored.
   */
  async addCustomStat(label) {
    return addCustomStat(this, label);
  }

  /**
   * Remove a custom stat through the character application service.
   *
   * @param {string} id Custom stat identifier.
   * @returns {Promise<void>} Completes after the stat is removed.
   */
  async deleteCustomStat(id) {
    return deleteCustomStat(this, id);
  }

  /**
   * Add a custom field through the character application service.
   *
   * @param {string} label Display label for the field.
   * @param {string} [fieldType="text"] Field value type.
   * @returns {Promise<void>} Completes after the field is stored.
   */
  async addCustomField(label, fieldType = "text") {
    return addCustomField(this, label, fieldType);
  }

  /**
   * Remove a custom field through the character application service.
   *
   * @param {string} id Custom field identifier.
   * @returns {Promise<void>} Completes after the field is removed.
   */
  async deleteCustomField(id) {
    return deleteCustomField(this, id);
  }

  /* -------------------------------------------- */
  /*  Armor damage                                */
  /* -------------------------------------------- */

  /**
   * Damage the equipped armor through the damage application service.
   *
   * @param {number} [steps=1] Number of Block-ease damage steps.
   * @returns {Promise<void>} Completes after the armor is updated.
   */
  async damageArmor(steps = 1) {
    return damageArmor(this, steps);
  }

  /**
   * Repair the equipped armor through the damage application service.
   *
   * @returns {Promise<void>} Completes after the armor is repaired.
   */
  async repairArmor() {
    return repairArmor(this);
  }

  /* -------------------------------------------- */
  /*  Damage and wounds                           */
  /* -------------------------------------------- */

  /**
   * Apply damage through the damage application service.
   *
   * @param {number} amount Raw damage amount.
   * @param {object} [options={}] Damage options.
   * @returns {Promise<number|undefined>} NPC damage dealt, when applicable.
   */
  async applyDamage(amount, options = {}) {
    return applyDamage(this, amount, options);
  }

  /**
   * Convert a damage amount into a wound severity.
   *
   * This remains a small compatibility facade around the pure wound rule.
   *
   * @param {number} amount Damage amount.
   * @returns {string|null} Corresponding wound severity.
   */
  _convertDamageToWound(amount) {
    return convertDamageToWound(amount);
  }

  /**
   * Add a wound through the damage application service.
   *
   * @param {string} severity Wound severity.
   * @returns {Promise<void>} Completes after the actor is updated.
   */
  async addWound(severity) {
    return addWound(this, severity);
  }

  /**
   * Compatibility facade for NPC damage application.
   *
   * @param {number} amount Raw damage amount.
   * @param {object} [options={}] Damage options.
   * @returns {Promise<number|undefined>} Damage actually applied.
   */
  async _applyNpcDamage(amount, options = {}) {
    return applyNpcDamage(this, amount, options);
  }

  /**
   * Synchronize wound-related token statuses through the damage service.
   *
   * @returns {Promise<void>} Completes after status synchronization.
   */
  async _syncWoundStatusEffects() {
    return syncWoundStatusEffects(this);
  }

  /* -------------------------------------------- */
  /*  Content application                         */
  /* -------------------------------------------- */

  /**
   * Apply a Type through the content application service.
   *
   * @param {object} typeItem Type Item.
   * @param {object} [options={}] Player choices.
   * @returns {Promise<boolean>} Whether the Type was applied.
   */
  async applyType(typeItem, options = {}) {
    return applyType(this, typeItem, options);
  }

  /**
   * Apply a Focus through the content application service.
   *
   * @param {object} focusItem Focus Item.
   * @param {string[]} abilityIds Selected tier-1 ability ids.
   * @param {object} [weaponSkillCategories={}] Weapon skill choices.
   * @returns {Promise<boolean>} Whether the Focus was applied.
   */
  async applyFocus(focusItem, abilityIds, weaponSkillCategories = {}) {
    return applyFocus(this, focusItem, abilityIds, weaponSkillCategories);
  }

  /**
   * Select an additional Focus ability through the content service.
   *
   * @param {string} abilityId Focus ability id.
   * @param {string|null} [weaponSkillCategory=null] Weapon skill choice.
   * @returns {Promise<boolean>} Whether the ability was selected.
   */
  async selectFocusAbility(abilityId, weaponSkillCategory = null) {
    return selectFocusAbility(this, abilityId, weaponSkillCategory);
  }

  /**
   * Apply a Descriptor through the content application service.
   *
   * @param {object} descriptorItem Descriptor Item.
   * @param {object} [options={}] Player choices.
   * @returns {Promise<boolean>} Whether the Descriptor was applied.
   */
  async applyDescriptor(descriptorItem, options = {}) {
    return applyDescriptor(this, descriptorItem, options);
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
  }
}
