const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Foundry VTT sheet for player characters using the Cypher system.
 *
 * Prepares template context and exposes UI actions for rolls, inventory,
 * advancement, recovery, and other player-character interactions.
 */
export default class CypherPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "actor", "pc"],
    position: { width: 720, height: 780 },
    window: { resizable: true, title: "CYPHER.Sheet.PC" },
    actions: {
      rollStat: CypherPCSheet.#onRollStat,
      rollRecovery: CypherPCSheet.#onRollRecovery,
      useCypher: CypherPCSheet.#onUseCypher,
      rollAttack: CypherPCSheet.#onRollAttack,
      rallyWound: CypherPCSheet.#onRallyWound,
      toggleSecondDescriptor: CypherPCSheet.#onToggleSecondDescriptor,
      toggleSecondFocus: CypherPCSheet.#onToggleSecondFocus,
      addCustomStat: CypherPCSheet.#onAddCustomStat,
      deleteCustomStat: CypherPCSheet.#onDeleteCustomStat,
      addCustomField: CypherPCSheet.#onAddCustomField,
      deleteCustomField: CypherPCSheet.#onDeleteCustomField,
      itemCreate: CypherPCSheet.#onItemCreate,
      itemEdit: CypherPCSheet.#onItemEdit,
      itemDelete: CypherPCSheet.#onItemDelete,
      toggleEquipped: CypherPCSheet.#onToggleEquipped,
      playerIntrusion: CypherPCSheet.#onPlayerIntrusion,
      purchaseAdvancement: CypherPCSheet.#onPurchaseAdvancement,
      rollDefense: CypherPCSheet.#onRollDefense,
      damageArmor: CypherPCSheet.#onDamageArmor,
      repairArmor: CypherPCSheet.#onRepairArmor,
      rollDepletion: CypherPCSheet.#onRollDepletion
    },
    form: { submitOnChange: true }
  };

  static PARTS = {
    header: { template: "systems/cypher/templates/actor/parts/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    main: { template: "systems/cypher/templates/actor/parts/main.hbs", scrollable: [""] },
    skills: { template: "systems/cypher/templates/actor/parts/skills.hbs", scrollable: [""] },
    abilities: { template: "systems/cypher/templates/actor/parts/abilities.hbs", scrollable: [""] },
    inventory: { template: "systems/cypher/templates/actor/parts/inventory.hbs", scrollable: [""] },
    advancement: { template: "systems/cypher/templates/actor/parts/advancement.hbs", scrollable: [""] },
    biography: { template: "systems/cypher/templates/actor/parts/biography.hbs", scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "main" },
        { id: "skills" },
        { id: "abilities" },
        { id: "inventory" },
        { id: "advancement" },
        { id: "biography" }
      ],
      initial: "main",
      labelPrefix: "CYPHER.Tab"
    }
  };

  tabGroups = { primary: "main" };

  /**
   * Prepares the actor, item collections, tabs, and enriched text used by the
   * sheet templates.
   *
   * @param {object} options Foundry application context options.
   * @returns {Promise<object>} Template context.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.actor.system;
    context.actor = this.actor;
    context.config = CONFIG.CYPHER;
    context.items = {
      skills: this.actor.items.filter(i => i.type === "skill"),
      abilities: this.actor.items.filter(i => i.type === "ability"),
      cyphers: this.actor.items.filter(i => i.type === "cypher"),
      artifacts: this.actor.items.filter(i => i.type === "artifact"),
      oddities: this.actor.items.filter(i => i.type === "oddity"),
      equipment: this.actor.items.filter(i => i.type === "equipment"),
      attacks: this.actor.items.filter(i => i.type === "attack"),
      armor: this.actor.items.filter(i => i.type === "armor"),
      shields: this.actor.items.filter(i => i.type === "shield")
    };
    context.tabs = this._prepareTabs("primary");
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.actor.system.biography, { relativeTo: this.actor });
    context.enrichedNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.actor.system.notes, { relativeTo: this.actor });
    return context;
  }

  /**
   * Adds the active tab state to an individual template-part context.
   *
   * @param {string} partId Sheet part identifier.
   * @param {object} context Current template context.
   * @returns {Promise<object>} Updated part context.
   */
  async _preparePartContext(partId, context) {
    context = await super._preparePartContext(partId, context);
    if (["main", "skills", "abilities", "inventory", "advancement", "biography"].includes(partId)) {
      context.tab = context.tabs[partId];
    }
    return context;
  }

  /* -------------------------------------------- */
  /*  Actions                                       */
  /* -------------------------------------------- */

  /**
   * Rolls a task for the selected stat after collecting roll options.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollStat(event, target) {
    const stat = target.dataset.stat;
    const difficulty = Number(target.dataset.difficulty ?? 3);
    const result = await CypherPCSheet.#promptRollOptions(this.actor, { difficulty });
    if (!result) return;
    await this.actor.rollTask({ stat, ...result });
  }

  /**
   * Opens the shared roll-options dialog used by task and attack rolls.
   *
   * @param {Actor} actor PC actor being rolled.
   * @param {object} [options] Roll configuration.
   * @param {number} [options.difficulty=3] Initial difficulty.
   * @param {boolean} [options.isAttack=false] Whether to expose attack-only
   *   options such as Lucky Shot.
   * @returns {Promise<object|null>} Selected roll options, or `null` if cancelled.
   */
  static async #promptRollOptions(actor, { difficulty = 3, isAttack = false } = {}) {
    const maxDifficulty = actor.system.maxDifficulty ?? 10;
    const maxEffort = actor.system.effort ?? 1;

    const skillOptions = actor.items.filter(i => i.type === "skill")
      .map(i => `<option value="${i.id}">${i.name} (${game.i18n.localize(`CYPHER.SkillLevel.${i.system.level}`)})</option>`).join("");

    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.Difficulty")}</label>
        <input type="number" name="difficulty" value="${difficulty}" min="0" max="${maxDifficulty}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.LinkedSkill")}</label>
        <select name="skillItemId">
          <option value="">${game.i18n.localize("CYPHER.Roll.NoSkill")}</option>
          ${skillOptions}
        </select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.EffortLevels")} (${game.i18n.format("CYPHER.Roll.MaxEffortHint", { max: maxEffort })})</label>
        <input type="number" name="effort" value="0" min="0" max="${maxEffort}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.AssetSteps")}</label>
        <input type="number" name="assets" value="0" min="0" max="2"/>
      </div>
      ${isAttack ? `
      <div class="form-group inline">
        <label><input type="checkbox" name="luckyShot"/> ${game.i18n.localize("CYPHER.XP.LuckyShot")} (${CONFIG.CYPHER.xpCosts.luckyShot} PX, ${game.i18n.localize("CYPHER.XP.LuckyShotHint")})</label>
      </div>` : ""}`;

    return foundry.applications.api.DialogV2.prompt({
      window: { title: isAttack ? game.i18n.localize("CYPHER.Roll.Attack") : game.i18n.localize("CYPHER.Roll.Task") },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Roll.Roll"),
        callback: (event, button) => {
          const form = button.form;
          return {
            difficulty: Number(form.difficulty.value),
            effortLevels: Number(form.effort.value),
            assetSteps: Number(form.assets.value),
            skillItemId: form.skillItemId.value || null,
            luckyShot: isAttack ? !!form.luckyShot?.checked : false
          };
        }
      }
    });
  }

  /**
   * Starts a recovery roll for the selected recovery interval.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollRecovery(event, target) {
    const interval = target.dataset.interval;
    await this.actor.rollRecovery(interval);
  }

  /**
   * Uses the selected cypher item.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onUseCypher(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.useCypher();
  }

  /**
   * Rolls the depletion check for the selected item.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollDepletion(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.rollDepletion();
  }

  /**
   * Collects attack roll options and delegates the roll to the selected attack item.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollAttack(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const result = await CypherPCSheet.#promptRollOptions(this.actor, { difficulty: 3, isAttack: true });
    if (!result) return;
    await item.rollAttack(result);
  }

  /**
   * Collects defense options and resolves a Block or Dodge roll.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollDefense(event, target) {
    const defenseType = target.dataset.defenseType; // "block" or "dodge"
    const maxDifficulty = this.actor.system.maxDifficulty ?? 10;
    const maxEffort = this.actor.system.effort ?? 1;

    // Only equipped, unbroken shields can contribute to a Block.
    const shields = defenseType === "block"
      ? this.actor.items.filter(i => i.type === "shield" && i.system.equipped && !i.system.broken)
      : [];
    const shieldOptions = shields.map(s => `<option value="${s.id}">${s.name}</option>`).join("");

    const skillOptions = this.actor.items.filter(i => i.type === "skill")
      .map(i => `<option value="${i.id}">${i.name} (${game.i18n.localize(`CYPHER.SkillLevel.${i.system.level}`)})</option>`).join("");

    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Defense.IncomingSeverity")}</label>
        <select name="incomingSeverity">
          <option value="minor">${game.i18n.localize("CYPHER.Wound.minor")}</option>
          <option value="moderate">${game.i18n.localize("CYPHER.Wound.moderate")}</option>
          <option value="major">${game.i18n.localize("CYPHER.Wound.major")}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.Difficulty")} (${game.i18n.localize("CYPHER.Defense.AttackerTarget")})</label>
        <input type="number" name="difficulty" value="3" min="0" max="${maxDifficulty}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.LinkedSkill")}</label>
        <select name="skillItemId">
          <option value="">${game.i18n.localize("CYPHER.Roll.NoSkill")}</option>
          ${skillOptions}
        </select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.EffortLevels")} (${game.i18n.format("CYPHER.Roll.MaxEffortHint", { max: maxEffort })})</label>
        <input type="number" name="effort" value="0" min="0" max="${maxEffort}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.AssetSteps")}</label>
        <input type="number" name="assets" value="0" min="0" max="2"/>
      </div>
      ${shields.length ? `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Shield.UseShield")}</label>
        <select name="shieldItemId">
          <option value="">${game.i18n.localize("CYPHER.Shield.NoneReduceInstead")}</option>
          ${shieldOptions}
        </select>
      </div>` : ""}`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize(defenseType === "block" ? "CYPHER.Defense.Block" : "CYPHER.Defense.Dodge") },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Roll.Roll"),
        callback: (event, button) => {
          const form = button.form;
          return {
            incomingSeverity: form.incomingSeverity.value,
            difficulty: Number(form.difficulty.value),
            effortLevels: Number(form.effort.value),
            assetSteps: Number(form.assets.value),
            skillItemId: form.skillItemId.value || null,
            shieldItemId: form.shieldItemId?.value || null
          };
        }
      }
    });

    if (!result) return;
    await this.actor.rollDefense(defenseType, result);
  }

  /**
   * Applies one point of damage to the actor's equipped armor.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onDamageArmor(event, target) {
    await this.actor.damageArmor(1);
  }

  /**
   * Confirms and repairs the actor's equipped armor.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRepairArmor(event, target) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CYPHER.Armor.Repair") },
      content: `<p>${game.i18n.localize("CYPHER.Armor.ConfirmRepair")}</p>`
    });
    if (confirmed) await this.actor.repairArmor();
  }

  /**
   * Prompts for a player intrusion description and applies its XP transaction.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onPlayerIntrusion(event, target) {
    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.XP.PlayerIntrusionPrompt")}</label>
        <textarea name="description" rows="3"></textarea>
      </div>`;
    const description = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${game.i18n.localize("CYPHER.XP.PlayerIntrusion")} (${CONFIG.CYPHER.xpCosts.playerIntrusion} PX)` },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => button.form.description.value
      }
    });
    if (description !== null && description !== undefined) await this.actor.usePlayerIntrusion(description);
  }

  /**
   * Collects advancement-specific choices and purchases the selected slot.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onPurchaseAdvancement(event, target) {
    const index = Number(target.dataset.slot);
    const slot = this.actor.system.advancementSlots[index];
    if (!slot?.type) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.ChooseAdvancementType"));
      return;
    }
    if (slot.type === "other" && !slot.otherType) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.ChooseAdvancementType"));
      return;
    }

    let extra = {};

    if (slot.type === "capabilities") {
      const content = `
        <p>${game.i18n.localize("CYPHER.Advancement.CapabilitiesDialogHint")}</p>
        <div class="form-group inline">
          <label>${game.i18n.localize("CYPHER.Stat.might")} <input type="number" name="might" value="0" min="0" max="4"/></label>
          <label>${game.i18n.localize("CYPHER.Stat.speed")} <input type="number" name="speed" value="0" min="0" max="4"/></label>
          <label>${game.i18n.localize("CYPHER.Stat.intellect")} <input type="number" name="intellect" value="0" min="0" max="4"/></label>
        </div>`;
      const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize("CYPHER.Advancement.capabilities") },
        content,
        ok: {
          label: game.i18n.localize("CYPHER.Confirm.Add"),
          callback: (event, button) => ({
            might: Number(button.form.might.value),
            speed: Number(button.form.speed.value),
            intellect: Number(button.form.intellect.value)
          })
        }
      });
      if (!result) return;
      if (result.might + result.speed + result.intellect !== 4) {
        ui.notifications.error(game.i18n.localize("CYPHER.Warning.CapabilitiesMustSumFour"));
        return;
      }
      extra.distribution = result;
    } else if (slot.type === "perfection") {
      const content = `
        <div class="form-group">
          <label>${game.i18n.localize("CYPHER.Stat.Label")}</label>
          <select name="stat">
            <option value="might">${game.i18n.localize("CYPHER.Stat.might")}</option>
            <option value="speed">${game.i18n.localize("CYPHER.Stat.speed")}</option>
            <option value="intellect">${game.i18n.localize("CYPHER.Stat.intellect")}</option>
          </select>
        </div>`;
      const stat = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize("CYPHER.Advancement.perfection") },
        content,
        ok: { label: game.i18n.localize("CYPHER.Confirm.Add"), callback: (event, button) => button.form.stat.value }
      });
      if (!stat) return;
      extra.stat = stat;
    } else if (slot.type === "skill") {
      const skillOptions = this.actor.items.filter(i => i.type === "skill")
        .map(i => `<option value="${i.id}">${i.name} (${game.i18n.localize(`CYPHER.SkillLevel.${i.system.level}`)})</option>`).join("");
      const content = `
        <div class="form-group">
          <label>${game.i18n.localize("CYPHER.Advancement.PickExistingSkill")}</label>
          <select name="skillId"><option value="">—</option>${skillOptions}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("CYPHER.Advancement.OrNewSkillName")}</label>
          <input type="text" name="newSkillName"/>
        </div>`;
      const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize("CYPHER.Advancement.skill") },
        content,
        ok: {
          label: game.i18n.localize("CYPHER.Confirm.Add"),
          callback: (event, button) => ({ skillId: button.form.skillId.value, newSkillName: button.form.newSkillName.value })
        }
      });
      if (!result) return;
      extra.skillId = result.skillId || null;
      extra.newSkillName = result.newSkillName || null;
      if (!extra.skillId && !extra.newSkillName) return;
    }

    await this.actor.purchaseAdvancementSlot(index, extra);
  }

  /**
   * Attempts to rally the selected wound severity.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRallyWound(event, target) {
    const severity = target.dataset.severity;
    await this.actor.rallyWound(severity);
  }

  /**
   * Toggles the optional second descriptor.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onToggleSecondDescriptor(event, target) {
    const enabled = this.actor.system.hasSecondDescriptor;
    if (enabled) {
      await this.actor.update({ "system.hasSecondDescriptor": false, "system.descriptor2": "" });
    } else {
      await this.actor.update({ "system.hasSecondDescriptor": true });
    }
  }

  /**
   * Toggles the optional second focus.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onToggleSecondFocus(event, target) {
    const enabled = this.actor.system.hasSecondFocus;
    if (enabled) {
      await this.actor.update({ "system.hasSecondFocus": false, "system.focus2": "" });
    } else {
      await this.actor.update({ "system.hasSecondFocus": true });
    }
  }

  /**
   * Prompts for and adds a player-defined stat.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onAddCustomStat(event, target) {
    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Stat.CustomName")}</label>
        <input type="text" name="label" placeholder="${game.i18n.localize("CYPHER.Stat.CustomNamePlaceholder")}"/>
      </div>`;

    const label = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CYPHER.Stat.AddCustom") },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => button.form.label.value
      }
    });

    if (label) await this.actor.addCustomStat(label);
  }

  /**
   * Confirms and removes the selected custom stat.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onDeleteCustomStat(event, target) {
    const id = target.closest("[data-stat-id]").dataset.statId;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CYPHER.Confirm.Delete") },
      content: `<p>${game.i18n.localize("CYPHER.Stat.ConfirmDeleteCustom")}</p>`
    });
    if (confirmed) await this.actor.deleteCustomStat(id);
  }

  /**
   * Prompts for and adds a player-defined custom field.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onAddCustomField(event, target) {
    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.CustomField.Label")}</label>
        <input type="text" name="label" placeholder="${game.i18n.localize("CYPHER.CustomField.LabelPlaceholder")}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.CustomField.Type")}</label>
        <select name="fieldType">
          <option value="text">${game.i18n.localize("CYPHER.CustomField.text")}</option>
          <option value="number">${game.i18n.localize("CYPHER.CustomField.number")}</option>
          <option value="checkbox">${game.i18n.localize("CYPHER.CustomField.checkbox")}</option>
        </select>
      </div>`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CYPHER.CustomField.Add") },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => ({
          label: button.form.label.value,
          fieldType: button.form.fieldType.value
        })
      }
    });

    if (result?.label) await this.actor.addCustomField(result.label, result.fieldType);
  }

  /**
   * Confirms and removes the selected custom field.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onDeleteCustomField(event, target) {
    const id = target.closest("[data-field-id]").dataset.fieldId;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CYPHER.Confirm.Delete") },
      content: `<p>${game.i18n.localize("CYPHER.CustomField.ConfirmDelete")}</p>`
    });
    if (confirmed) await this.actor.deleteCustomField(id);
  }

  /**
   * Creates a new embedded item of the requested type.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onItemCreate(event, target) {
    const type = target.dataset.type;
    const name = game.i18n.format("CYPHER.Item.New", { type: game.i18n.localize(`TYPES.Item.${type}`) });
    await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
  }

  /**
   * Opens the selected embedded item's sheet.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onItemEdit(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    item?.sheet.render(true);
  }

  /**
   * Confirms and deletes the selected embedded item.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onItemDelete(event, target) {
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li.dataset.itemId);
    if (!item) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CYPHER.Confirm.Delete") },
      content: `<p>${game.i18n.format("CYPHER.Confirm.DeleteItem", { name: item.name })}</p>`
    });
    if (confirmed) await item.delete();
  }

  /**
   * Toggles an item's equipped state and enforces the single-equipped-armor rule.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onToggleEquipped(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    if (!item) return;
    const newState = !item.system.equipped;

    // Only one Armor item may be equipped at a time.
    if (item.type === "armor" && newState) {
      const others = this.actor.items.filter(i => i.type === "armor" && i.id !== item.id && i.system.equipped);
      if (others.length) {
        await this.actor.updateEmbeddedDocuments("Item", others.map(i => ({ _id: i.id, "system.equipped": false })));
      }
    }

    await item.update({ "system.equipped": newState });
  }
}
