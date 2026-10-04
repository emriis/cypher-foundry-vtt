import { CYPHER } from "../config.mjs";
import {
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
import { rollTask } from "../applications/task-service.mjs";
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
  /*  Stat resolution                                */
  /* -------------------------------------------- */

  /**
   * Resolves a stat key (one of the three core stats, or a custom stat by id) to its
   * data and the update path to use.
   */
  _resolveStat(statKey) {
    if (CYPHER.stats.includes(statKey)) {
      return { data: this.system.stats[statKey], path: `system.stats.${statKey}`, label: `CYPHER.Stat.${statKey}` };
    }
    const index = this.system.customStats.findIndex(s => s.id === statKey);
    if (index === -1) return null;
    const data = this.system.customStats[index];
    return { data, path: `system.customStats.${index}`, label: data.label };
  }

  /* -------------------------------------------- */
  /*  Task rolls                                    */
  /* -------------------------------------------- */

  /**
   * Rolls a Cypher task: d20 vs (difficulty - steps) * 3.
   */
  /**
   * Rolls a Cypher task through the application service.
   *
   * Kept as a compatibility facade for sheets, macros, and existing callers.
   */
  async rollTask(options = {}) {
    return rollTask(this, options);
  }

  /**
   * Reduces a wound severity by one step (major→moderate→minor→none).
   */
  /**
   * Reduce a wound severity by one step.
   *
   * Compatibility facade for the extracted damage application service.
   *
   * @param {string} severity Current wound severity.
   * @returns {string|null} Reduced severity, or null when the wound disappears.
   */
  _reduceWoundSeverity(severity) {
    return reduceWound(severity);
  }

  /**
   * Has a shield absorb a whole wound, with cascading overflow (3 minor → 2 moderate →
   * 1 major, per the rules). The shield is destroyed as soon as it takes a major wound.
   */
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
   * Rolls a Defense task: Block (Might, eased by armor) or Dodge (Speed, hindered by armor),
   * against the attacker's target number. A successful Block reduces the wound's severity by
   * one step; a successful Dodge avoids it entirely; a failure inflicts the wound as-is.
   */
  async rollDefense(defenseType, { difficulty = 3, effortLevels = 0, assetSteps = 0, incomingSeverity = "minor", shieldItemId = null, skillItemId = null } = {}) {
    if (this.type !== "pc") return null;
    const { stat, armorModifier } = resolveDefense(
      defenseType,
      this.system.armor
    );

    return this.rollTask({
      stat, difficulty, effortLevels, assetSteps, armorModifier, skillItemId,
      defenseType, incomingSeverity, shieldItemId,
      flavor: `${game.i18n.localize(defenseType === "block" ? "CYPHER.Defense.Block" : "CYPHER.Defense.Dodge")}`
    });
  }

  /* -------------------------------------------- */
  /*  Experience Points                              */
  /* -------------------------------------------- */

  /**
   * Spends XP if the character has enough. Returns true if the spend succeeded.
   */
  /**
   * Spend XP through the application service.
   *
   * Kept as a compatibility facade for sheets, macros, and existing callers.
   *
   * @param {number} amount Number of XP to spend.
   * @param {string} [reasonLabel=""] Localized reason shown in the warning.
   * @returns {Promise<boolean>} Whether the XP was spent.
   */
  async spendXP(amount, reasonLabel = "") {
    return spendXP(this, amount, reasonLabel);
  }

  /**
   * Rerolls a previous roll by spending 1 XP, keeping the better of the two results.
   */
  /**
   * Reroll a previous roll through the application service.
   *
   * @param {object} message Foundry chat message containing reroll flags.
   * @returns {Promise<void>|undefined} Nothing when the message is not rerollable.
   */
  async rerollMessage(message) {
    return rerollMessage(this, message);
  }

  /**
   * Rerolls a depletion check (1 XP), keeping the better of the two results (the higher one,
   * since a higher result avoids depletion).
   */
  /**
   * Compatibility facade for the depletion reroll implementation.
   *
   * New callers should use rerollMessage instead of this internal helper.
   *
   * @param {object} message Foundry chat message.
   * @param {object} flags Reroll metadata.
   * @returns {Promise<void>} Completes after the reroll.
   */
  async _rerollDepletion(message, flags) {
    return rerollMessage(this, message, flags);
  }

  /**
   * Player intrusion: spend 1 XP to alter the situation in the character's favor.
   */
  /**
   * Use a Player Intrusion through the application service.
   *
   * @param {string} description Player-provided intrusion description.
   * @returns {Promise<void>} Completes after the intrusion message is created.
   */
  async usePlayerIntrusion(description) {
    return usePlayerIntrusion(this, description);
  }

  /* -------------------------------------------- */
  /*  Character advancement                           */
  /* -------------------------------------------- */

  /**
   * Purchases an advancement slot for the current tier (4 XP). Automatically applies the
   * matching mechanical effect, and advances the character a tier once all 4 slots are bought.
   */
  /** Compatibility facade for advancement callers. */
  async purchaseAdvancementSlot(index, extra = {}) {
    return purchaseAdvancementSlot(this, index, extra);
  }

  /** Compatibility facade for tier advancement callers. */
  async _advanceTier() {
    return advanceTier(this);
  }

  /* -------------------------------------------- */
  /*  Recovery rolls                                 */
  /* -------------------------------------------- */

  /**
   * Takes a recovery: restores 1d6+Tier Pool points and removes wounds
   * based on the chosen interval.
   */
  /** Compatibility facade for recovery callers. */
  async rollRecovery(interval = "hour") {
    return rollRecovery(this, interval);
  }

  /**
   * Rally: spend Might points to remove a wound. A major wound can only be rallied
   * in the Superhero genre (cost: 10 Might).
   */
  /** Compatibility facade for Rally callers. */
  async rallyWound(severity) {
    return rallyWound(this, severity);
  }

  /* -------------------------------------------- */
  /*  Custom stats                                   */
  /* -------------------------------------------- */

  /**
   * Adds a custom stat (in addition to Might/Speed/Intellect).
   */
  async addCustomStat(label) {
    if (this.type !== "pc" || !label?.trim()) return;
    const id = label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `stat-${foundry.utils.randomID(6)}`;

    if (CYPHER.stats.includes(id) || this.system.customStats.some(s => s.id === id)) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.CustomStatExists"));
      return;
    }

    const customStats = this.system.customStats.map(s => ({ ...s }));
    customStats.push({ id, label: label.trim(), pool: { max: 8, value: 8 }, edge: 0 });
    await this.update({ "system.customStats": customStats });
  }

  async deleteCustomStat(id) {
    if (this.type !== "pc") return;
    const customStats = this.system.customStats.filter(s => s.id !== id);
    await this.update({ "system.customStats": customStats });
  }

  /* -------------------------------------------- */
  /*  Champs Libres / Custom fields                 */
  /* -------------------------------------------- */

  /**
   * Adds a custom field (text, number, or checkbox) — to add any character element the
   * system doesn't already provide for, independent of genre.
   */
  async addCustomField(label, fieldType = "text") {
    if (this.type !== "pc" || !label?.trim()) return;
    if (!CYPHER.customFieldTypes.includes(fieldType)) fieldType = "text";

    const id = `field-${foundry.utils.randomID(8)}`;
    const customFields = this.system.customFields.map(f => ({ ...f }));
    customFields.push({
      id, label: label.trim(), fieldType,
      valueText: "", valueNumber: 0, valueBoolean: false
    });
    await this.update({ "system.customFields": customFields });
  }

  async deleteCustomField(id) {
    if (this.type !== "pc") return;
    const customFields = this.system.customFields.filter(f => f.id !== id);
    await this.update({ "system.customFields": customFields });
  }

  /* -------------------------------------------- */
  /*  Armor damage                                   */
  /* -------------------------------------------- */

  /**
   * Damages the worn armor (special attack or GM intrusion): reduces its Block-easing bonus
   * by a given number of steps, capped at the base bonus (can't go below 0). The Dodge
   * hindrance is never affected.
   */
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
   * Repairs the equipped armor, clearing all accumulated damage to its Block bonus.
   */
  /**
   * Repair the equipped armor through the damage application service.
   *
   * @returns {Promise<void>} Completes after the armor is repaired.
   */
  async repairArmor() {
    return repairArmor(this);
  }

  /* -------------------------------------------- */
  /*  Damage and wounds                              */
  /* -------------------------------------------- */

  /**
   * Applies damage. For a PC, converts the amount to a wound severity
   * (1-4 minor, 5-8 moderate, 9+ major) unless an explicit severity is given.
   */
  /**
   * Apply damage through the damage application service.
   *
   * @param {number} amount Raw damage amount.
   * @param {object} [options={}] Damage options.
   * @returns {Promise<number|undefined>} NPC damage dealt, when applicable.
   */
  async applyDamage(amount, options = {}) {
    return applyDamage(this, amount, options);
  } = {}) {
    if (this.type !== "pc") return this._applyNpcDamage(amount, { ignoreArmor });

    // Direct Pool damage converts any overflow into a wound via the conversion table.
    if (stat) {
      const resolved = this._resolveStat(stat);
      if (!resolved) return;
      const pool = resolved.data.pool;
      const overflow = Math.max(0, amount - pool.value);
      const newValue = Math.max(0, pool.value - amount);
      await this.update({ [`${resolved.path}.pool.value`]: newValue });
      if (overflow > 0) {
        const woundSeverity = severity ?? this._convertDamageToWound(overflow);
        await this.addWound(woundSeverity);
      }
      return;
    }

    const woundSeverity = severity ?? this._convertDamageToWound(amount);
    await this.addWound(woundSeverity);
  }

  /**
   * Convert a damage amount into a wound severity.
   *
   * Compatibility facade for the pure wound rule.
   *
   * @param {number} amount Damage amount.
   * @returns {string|null} Corresponding wound severity.
   */
  _convertDamageToWound(amount) {
    return convertDamageToWound(amount);
  }

  /**
   * Adds a wound of a given severity, with cascading overflow.
   */
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
  } = {}) {
    const armor = ignoreArmor ? 0 : (this.system.armor ?? 0);
    const finalDamage = Math.max(0, amount - armor);
    const health = this.system.health;
    if (!health) return;
    const newValue = Math.max(0, health.value - finalDamage);
    await this.update({ "system.health.value": newValue });
    return finalDamage;
  }

  /**
   * Toggles the "Hindered" and "Dead" token status icons based on the current wound state.
   */
  /**
   * Synchronize wound-related token statuses through the damage service.
   *
   * @returns {Promise<void>} Completes after status synchronization.
   */
  async _syncWoundStatusEffects() {
    return syncWoundStatusEffects(this);
  }

  /* -------------------------------------------- */
  /*  Types                                         */
  /* -------------------------------------------- */

  /**
   * Applies the mechanical benefits of a Type dropped from a compendium.
   * The source Type is not embedded on the actor; its applied id is stored so
   * dropping it again cannot grant the benefits twice.
   */
  async applyType(typeItem, { stat = null, skillName = null } = {}) {
    if (this.type !== "pc" || typeItem?.type !== "type") return false;
    if (this.getFlag("cypher", "appliedTypeId")) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Type.AlreadyApplied"));
      return false;
    }

    const system = typeItem.system;
    const poolBonuses = system.poolBonuses ?? {};
    const woundBonuses = system.woundBonuses ?? {};
    const chosenStat = stat && CYPHER.stats.includes(stat) ? stat : "might";
    const updates = {
      "system.type": typeItem.name,
      "system.genre": { Fantasy: "fantasy", "Science Fiction": "sciFi", Superheroes: "superhero" }[system.genre] ?? this.system.genre,
      "flags.cypher.appliedTypeId": typeItem.id ?? typeItem._id
    };

    for (const statName of CYPHER.stats) {
      const amount = Number(poolBonuses[statName]) || 0;
      if (!amount) continue;
      updates[`system.stats.${statName}.pool.max`] = this.system.stats[statName].pool.max + amount;
      updates[`system.stats.${statName}.pool.value`] = this.system.stats[statName].pool.value + amount;
    }
    if (system.edgeChoice) {
      updates[`system.stats.${chosenStat}.edge`] = this.system.stats[chosenStat].edge + Number(system.edgeChoice);
    }
    for (const severity of CYPHER.woundSeverities) {
      const amount = Number(woundBonuses[severity]) || 0;
      if (amount) updates[`system.wounds.${severity}.max`] = this.system.wounds[severity].max + amount;
    }
    if (Array.isArray(system.freeWeaponCategories) && system.freeWeaponCategories.length) {
      updates["system.freeWeaponCategories"] = [...new Set([
        ...(this.system.freeWeaponCategories ?? []),
        ...system.freeWeaponCategories
      ])];
    } else if (system.freeWeapons) {
      updates["system.canFreelyUseAllWeapons"] = true;
    }
    if (Array.isArray(system.freeArmorCategories) && system.freeArmorCategories.length) {
      updates["system.freeArmorCategories"] = [...new Set([
        ...(this.system.freeArmorCategories ?? []),
        ...system.freeArmorCategories
      ])];
    } else if (system.freeArmor) {
      updates["system.canFreelyUseAllArmor"] = true;
    }
    if (Array.isArray(system.freeWeaponFamilies) && system.freeWeaponFamilies.length) {
      updates["system.freeWeaponFamilies"] = [...new Set([
        ...(this.system.freeWeaponFamilies ?? []),
        ...system.freeWeaponFamilies
      ])];
    }

    await this.update(updates);

    const finalSkillName = skillName?.trim() || (system.skillOptions ?? []).find(value => value?.trim());
    let skillNote = "";
    if (finalSkillName) {
      const existing = this.items.find(item => item.type === "skill" && item.name.toLowerCase() === finalSkillName.toLowerCase());
      if (existing) {
        const order = ["inability", "practiced", "trained", "specialized", "expert"];
        const index = Math.max(0, order.indexOf(existing.system.level));
        const newLevel = order[Math.min(order.length - 1, index + 1)];
        await existing.update({ "system.level": newLevel });
        skillNote = game.i18n.format("CYPHER.Type.SkillUpgraded", { name: existing.name, level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`) });
      } else {
        await this.createEmbeddedDocuments("Item", [{
          name: finalSkillName,
          type: "skill",
          system: { level: "trained", description: game.i18n.format("CYPHER.Type.GrantedFrom", { name: typeItem.name }) }
        }]);
        skillNote = game.i18n.format("CYPHER.Type.SkillGranted", { name: finalSkillName });
      }
    }

    const abilities = (system.abilities ?? []).map(ability => ({
      name: ability.name,
      type: "ability",
      system: {
        source: typeItem.name,
        tier: Number(ability.tier) || 1,
        enabler: Boolean(ability.enabler),
        cost: ability.cost ?? { stat: "none", amount: 0, options: [] },
        action: "none",
        effects: ability.effects ?? [],
        rollTables: ability.rollTables ?? [],
        description: ability.description ?? ""
      }
    }));
    if (abilities.length) await this.createEmbeddedDocuments("Item", abilities);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="cypher-roll-card"><h3>${game.i18n.format("CYPHER.Type.Applied", { name: typeItem.name })}</h3><p>${skillNote}</p></div>`
    });
    return true;
  }

  /* -------------------------------------------- */
  /*  Focuses                                      */
  /* -------------------------------------------- */

  /**
   * Applies a Focus and its two required tier-1 abilities to a PC.
   *
   * @param {Item} focusItem Focus compendium item.
   * @param {string[]} abilityIds Two initial tier-1 Focus ability ids.
   * @returns {Promise<boolean>} Whether the Focus was applied.
   */
  async applyFocus(focusItem, abilityIds, weaponSkillCategories = {}) {
    if (this.type !== "pc" || focusItem?.type !== "focus") return false;
    if (this.getFlag("cypher", "appliedFocusId")) return false;

    const selected = [...new Set(abilityIds ?? [])];
    if (selected.length !== 2 || !selected.every(id => CypherActor.isFocusAbilityEligible(focusItem.system, [], id, 1))) {
      return false;
    }

    const selectedAbilities = focusItem.system.abilities.filter(ability => selected.includes(ability.id));
    if (selectedAbilities.some(ability =>
      ability.chooseWeaponAttackCategory
      && !CYPHER.attackSkillCategories.includes(weaponSkillCategories[ability.id])
    )) return false;
    const freeWeaponCategories = selectedAbilities.flatMap(ability => ability.freeWeaponCategories ?? []);
    const freeArmorCategories = selectedAbilities.flatMap(ability => ability.freeArmorCategories ?? []);
    const freeWeaponFamilies = selectedAbilities.flatMap(ability => ability.freeWeaponFamilies ?? []);
    const freeWeaponSkillCategories = [
      ...selectedAbilities.flatMap(ability => ability.freeWeaponSkillCategories ?? []),
      ...Object.values(weaponSkillCategories)
    ];
    await this.update({
      "system.focus": focusItem.name,
      "system.freeWeaponCategories": [...new Set([
        ...(this.system.freeWeaponCategories ?? CYPHER.coreFreeWeaponCategories),
        ...freeWeaponCategories
      ])],
      "system.freeArmorCategories": [...new Set([
        ...(this.system.freeArmorCategories ?? CYPHER.coreFreeArmorCategories),
        ...freeArmorCategories
      ])],
      "system.freeWeaponFamilies": [...new Set([
        ...(this.system.freeWeaponFamilies ?? []),
        ...freeWeaponFamilies
      ])],
      "system.freeWeaponSkillCategories": [...new Set([
        ...(this.system.freeWeaponSkillCategories ?? []),
        ...freeWeaponSkillCategories
      ])],
      "flags.cypher.appliedFocusId": focusItem.id ?? focusItem._id,
      "flags.cypher.appliedFocusGraph": focusItem.system,
      "flags.cypher.focusAbilityIds": selected
    });
    const selectedItems = selectedAbilities.map(ability => CypherActor._focusAbilityItemData(focusItem, ability));
    const armorItems = selectedAbilities
      .filter(ability => ability.grantedArmorItemCategory)
      .map(ability => CypherActor._focusArmorItemData(focusItem, ability));
    await this.createEmbeddedDocuments("Item", [...selectedItems, ...armorItems]);
    return true;
  }

  /**
   * Selects one additional Focus ability after a character reaches a new tier.
   *
   * @param {string} abilityId Focus ability id to select.
   * @returns {Promise<boolean>} Whether the ability was selected.
   */
  async selectFocusAbility(abilityId, weaponSkillCategory = null) {
    if (this.type !== "pc") return false;
    const focus = this.getFlag("cypher", "appliedFocusGraph");
    const selected = this.getFlag("cypher", "focusAbilityIds") ?? [];
    if (!CypherActor.isFocusAbilityEligible(focus, selected, abilityId, this.system.tier)) return false;

    const ability = focus.abilities.find(candidate => candidate.id === abilityId);
    if (ability.chooseWeaponAttackCategory && !CYPHER.attackSkillCategories.includes(weaponSkillCategory)) return false;
    const updates = {
      "flags.cypher.focusAbilityIds": [...selected, abilityId],
      "flags.cypher.focusAbilityPendingTier": null
    };
    const freeWeaponCategories = ability.freeWeaponCategories ?? [];
    const freeArmorCategories = ability.freeArmorCategories ?? [];
    const freeWeaponFamilies = ability.freeWeaponFamilies ?? [];
    const freeWeaponSkillCategories = [
      ...(ability.freeWeaponSkillCategories ?? []),
      ...(weaponSkillCategory ? [weaponSkillCategory] : [])
    ];
    if (freeWeaponCategories.length) {
      updates["system.freeWeaponCategories"] = [...new Set([
        ...(this.system.freeWeaponCategories ?? CYPHER.coreFreeWeaponCategories),
        ...freeWeaponCategories
      ])];
    }
    if (freeArmorCategories.length) {
      updates["system.freeArmorCategories"] = [...new Set([
        ...(this.system.freeArmorCategories ?? CYPHER.coreFreeArmorCategories),
        ...freeArmorCategories
      ])];
    }
    if (freeWeaponFamilies.length) {
      updates["system.freeWeaponFamilies"] = [...new Set([
        ...(this.system.freeWeaponFamilies ?? []),
        ...freeWeaponFamilies
      ])];
    }
    if (freeWeaponSkillCategories.length) {
      updates["system.freeWeaponSkillCategories"] = [...new Set([
        ...(this.system.freeWeaponSkillCategories ?? []),
        ...freeWeaponSkillCategories
      ])];
    }
    await this.update({
      ...updates
    });
    const items = [CypherActor._focusAbilityItemData({ name: this.system.focus }, ability)];
    if (ability.grantedArmorItemCategory) items.push(CypherActor._focusArmorItemData({ name: this.system.focus }, ability));
    await this.createEmbeddedDocuments("Item", items);
    return true;
  }

  /**
   * Creates the embedded Item data for one selected Focus ability.
   *
   * @param {Item|object} focus Focus item or focus-like source.
   * @param {object} ability Focus ability graph node.
   * @returns {object} Embedded ability item data.
   */
  static _focusAbilityItemData(focus, ability) {
    return {
      name: ability.name,
      type: "ability",
      system: {
        source: focus.name,
        focusAbilityId: ability.id,
        tier: ability.tier,
        enabler: ability.enabler,
        cost: ability.cost,
        action: "none",
        effects: ability.effects ?? [],
        rollTables: ability.rollTables ?? [],
        description: ability.description
      }
    };
  }

  /**
   * Creates the individual armor item granted by a Focus ability.
   *
   * This keeps a Focus-created suit's free use attached to that item instead
   * of granting the same permission for every armor item of its category.
   */
  static _focusArmorItemData(focus, ability) {
    return {
      name: ability.name,
      type: "armor",
      system: {
        category: ability.grantedArmorItemCategory,
        freelyUsable: true,
        equipped: false,
        blockEaseDamage: 0,
        description: game.i18n.format("CYPHER.FocusSelection.ArmorItemDescription", { name: focus.name })
      }
    };
  }

  /* -------------------------------------------- */
  /*  Descriptors                                    */
  /* -------------------------------------------- */

  /**
   * Applies a CRD Descriptor to the character: increases the chosen Pool by the given amount
   * and creates (or advances) a trained Skill. Unlike a normal item, the Descriptor itself is
   * never embedded on the actor — only its effect is, mirroring how a Type or Focus work in
   * the CRD (see also system.descriptor, already shown in the header's character sentence).
   *
  * @param {Item} descriptorItem The Descriptor item (compendium or world) to apply
   * @param {object} [options]
  * @param {string} [options.stat] Chosen stat among statOptions (ignored if only one choice)
  * @param {string} [options.skillName] Chosen skill name (from skillOptions, or freely typed)
   */
  async applyDescriptor(descriptorItem, { stat = null, skillName = null } = {}) {
    if (this.type !== "pc" || descriptorItem?.type !== "descriptor") return false;

    const isSpecies = descriptorItem.system.category === "species";
    const descriptorId = descriptorItem.id ?? descriptorItem._id;
    if (isSpecies) {
      const genres = descriptorItem.system.genres ?? [];
      if (!genres.includes(this.system.genre)) {
        ui.notifications.warn(game.i18n.localize("CYPHER.Descriptor.SpeciesWrongGenre"));
        return false;
      }
      if (this.getFlag("cypher", "appliedSpeciesId")) {
        ui.notifications.warn(game.i18n.localize("CYPHER.Descriptor.SpeciesAlreadyApplied"));
        return false;
      }
    } else if (this.getFlag("cypher", "appliedDescriptorId")) {
      if (!this.system.hasSecondDescriptor || this.getFlag("cypher", "appliedSecondDescriptorId")) {
        ui.notifications.warn(game.i18n.localize("CYPHER.Descriptor.AlreadyApplied"));
        return false;
      }
    }

    const statOptions = descriptorItem.system.statOptions ?? [];
    const chosenStat = stat && statOptions.includes(stat) ? stat : statOptions[0];
    const finalSkillName = skillName?.trim();
    const amount = descriptorItem.system.statAmount ?? 2;
    const applyingSecondDescriptor = !isSpecies && Boolean(this.getFlag("cypher", "appliedDescriptorId"));
    const updates = isSpecies
      ? {
          "system.species": descriptorItem.name,
          "system.hasSecondDescriptor": Boolean(descriptorItem.system.grantsSecondDescriptor),
          "flags.cypher.appliedSpeciesId": descriptorId
        }
      : applyingSecondDescriptor
        ? { "system.descriptor2": descriptorItem.name, "flags.cypher.appliedSecondDescriptorId": descriptorId }
        : { "system.descriptor": descriptorItem.name, "flags.cypher.appliedDescriptorId": descriptorId };

    if (chosenStat && amount > 0) {
      updates[`system.stats.${chosenStat}.pool.max`] = this.system.stats[chosenStat].pool.max + amount;
      updates[`system.stats.${chosenStat}.pool.value`] = this.system.stats[chosenStat].pool.value + amount;
    }
    await this.update(updates);

    // Advance an existing skill of the same name, or create a new trained skill, using the
    // same progression logic as purchaseAdvancementSlot's "skill" advancement.
    const order = ["inability", "practiced", "trained", "specialized", "expert"];
    const grantedSkills = (descriptorItem.system.grantedSkills ?? []).map(name => name.trim()).filter(Boolean);
    const skillNames = [...new Set([finalSkillName, ...grantedSkills].filter(Boolean))];
    const chatNotes = [];

    for (const grantedSkillName of skillNames) {
      const existing = this.items.find(item => item.type === "skill" && item.name.toLowerCase() === grantedSkillName.toLowerCase());
      if (existing) {
        const newLevel = existing.system.level === "inability"
          ? "trained"
          : order[Math.min(order.length - 1, order.indexOf(existing.system.level) + 1)];
        await existing.update({ "system.level": newLevel });
        chatNotes.push(game.i18n.format("CYPHER.Descriptor.SkillUpgraded", { name: existing.name, level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`) }));
      } else {
        const [created] = await this.createEmbeddedDocuments("Item", [{
          name: grantedSkillName,
          type: "skill",
          system: {
            level: "trained",
            description: game.i18n.format("CYPHER.Descriptor.GrantedFrom", { name: descriptorItem.name })
          }
        }]);
        chatNotes.push(game.i18n.format("CYPHER.Descriptor.SkillGranted", { name: created.name }));
      }
    }

    const benefits = descriptorItem.system.benefits ?? [];
    if (benefits.length) {
      await this.createEmbeddedDocuments("Item", benefits.map(benefit => ({
        name: benefit.name,
        type: "ability",
        system: {
          source: descriptorItem.name,
          tier: 1,
          enabler: true,
          cost: { stat: "none", amount: 0, options: [] },
          action: "none",
          description: benefit.description
        }
      })));
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="cypher-roll-card">
        <h3>${game.i18n.format(isSpecies ? "CYPHER.Descriptor.SpeciesApplied" : "CYPHER.Descriptor.Applied", { name: descriptorItem.name })}</h3>
        ${chosenStat && amount > 0 ? `<p>${game.i18n.format("CYPHER.Descriptor.StatNote", { amount, stat: game.i18n.localize(`CYPHER.Stat.${chosenStat}`) })}</p>` : ""}
        ${chatNotes.map(note => `<p>${note}</p>`).join("")}
      </div>`
    });
    return true;
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
  }
}
