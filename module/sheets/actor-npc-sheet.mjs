import { followerNPCDisplay } from "../applications/follower-service.mjs";
import { extendWeaponEffect, getWeaponEffectDisplayData } from "../applications/weapon-effect-service.mjs";
import { getAvailableShields } from "../applications/equipment-service.mjs";
import { generalEffectDisplay, toggleGuarding, clearGeneralEffect, promptGeneralCondition, incomingCooperationChoices } from "./general-action-dialogs.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Foundry sheet for NPC actors.
 *
 * Provides NPC-specific context enrichment and a damage application dialog
 * while delegating common sheet behavior to ActorSheetV2.
 */
export default class CypherNPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // Keep actual sheet instances, including synthetic token Actors. Resolving
  // them again through game.actors would lose the token-specific effect state.
  static #openSheets = new Set();

  /**
   * Refresh duration display after a combat boundary without document writes.
   * Called by bootstrap hooks; closed sheets are never opened by a clock change.
   * @returns {Promise<void>} Resolves after visible NPC sheets have rendered.
   */
  static async refreshWeaponEffects() {
    for (const sheet of [...CypherNPCSheet.#openSheets]) {
      if (sheet.rendered && sheet.actor.flags?.cypher?.activeWeaponEffects?.length) await sheet.render();
    }
  }

  /** Register a visible sheet after Foundry finishes rendering its content. */
  async _onRender(context, options) {
    await super._onRender(context, options);
    CypherNPCSheet.#openSheets.add(this);
  }

  /** Release the sheet reference as soon as its window has closed. */
  _onClose(options) {
    CypherNPCSheet.#openSheets.delete(this);
    super._onClose(options);
  }

  /** Default application configuration and sheet actions. */
  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "actor", "npc"],
    position: { width: 600, height: 680 },
    window: { resizable: true, title: "CYPHER.Sheet.NPC" },
    actions: {
      toggleGuarding, clearGeneralEffect, promptGeneralCondition,
      applyDamage: CypherNPCSheet.#onApplyDamage,
      rollNpcAttack: CypherNPCSheet.#onRollNpcAttack,
      extendWeaponEffect: CypherNPCSheet.#onExtendWeaponEffect
    },
    form: { submitOnChange: true }
  };

  /** Handlebars template parts rendered by the sheet. */
  static PARTS = {
    sheet: {
      root: true,
      template: "systems/cypher/templates/actor/npc.hbs",
      templates: [
        "systems/cypher/templates/actor/npc/header.hbs",
        "systems/cypher/templates/actor/npc/body.hbs",
        "systems/cypher/templates/actor/parts/general-actions.hbs"
      ],
      scrollable: [".npc-body"]
    }
  };

  /**
   * Builds the template context and enriches NPC narrative fields for rendering.
   * @param {object} options Application context options.
   * @returns {Promise<object>} Template rendering context.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.actor.system;
    context.actor = this.actor;
    context.followerProfile = await followerNPCDisplay(this.actor);
    context.generalEffects = generalEffectDisplay(this.actor);
    // Read-only presentation; expiry/persistence belongs to the effect service.
    context.weaponEffects = getWeaponEffectDisplayData(this.actor).map(effect => ({
      ...effect,
      effectLabel: effect.effect === "hindered"
        ? game.i18n.format("CYPHER.NPC.EffectHindered", { steps: effect.hinderSteps })
        : game.i18n.localize("CYPHER.NPC.LostNextAction"),
      durationLabel: effect.rounds === null ? game.i18n.localize("CYPHER.NPC.EffectNextAction")
        : game.i18n.format("CYPHER.NPC.EffectRounds", { rounds: effect.rounds })
    }));

    const enrich = (html) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", { relativeTo: this.actor });
    context.enrichedCombat = await enrich(this.actor.system.combat);
    context.enrichedInteraction = await enrich(this.actor.system.interaction);
    context.enrichedUse = await enrich(this.actor.system.use);
    context.enrichedLoot = await enrich(this.actor.system.loot);
    context.enrichedGmNotes = await enrich(this.actor.system.gmNotes);

    return context;
  }

  /** Apply the GM's optional second round; the service rechecks authorization. */
  static async #onExtendWeaponEffect(event, target) {
    if (await extendWeaponEffect(this.actor, target.dataset.effectId)) await this.render();
  }

  /**
   * Starts a structured NPC attack against the single targeted PC.
   *
   * @param {Event} event Action event supplied by Foundry.
   * @param {HTMLElement} target Action target supplied by Foundry.
   * @returns {Promise<void>}
   */
  static async #onRollNpcAttack(event, target) {
    const index = Number(target.dataset.attackIndex);
    const attack = this.actor.system.attacks?.[index];
    if (!attack) return;

    let selectedTarget = game.user?.targets?.size === 1
      ? [...game.user.targets][0]?.actor
      : null;

    if (selectedTarget?.type !== "pc") {
      ui.notifications.warn(game.i18n.localize("CYPHER.NPC.SinglePCTarget"));
      return;
    }

    const cooperationChoices = await incomingCooperationChoices(this.actor, selectedTarget);
    // Preserve the actual target Actor and let the player/GM explicitly choose
    // absorption instead of silently spending a shield's remaining wounds.
    const shieldOptions = (attack.damage?.mode === "wound" ? getAvailableShields(selectedTarget) : [])
      .map(item => `<option value="shield:${item.id}">${game.i18n.localize("CYPHER.Defense.Block")} — ${foundry.utils.escapeHTML(item.name)}</option>`)
      .join("");
    const drawnShields = (attack.damage?.mode === "wound" && cooperationChoices.drawTarget ? getAvailableShields(cooperationChoices.drawTarget) : [])
      .map(item => `<option value="drawShield:${item.id}">${game.i18n.localize("CYPHER.General.drawShield")} — ${foundry.utils.escapeHTML(item.name)}</option>`).join("");
    const result = await foundry.applications.api.DialogV2.prompt({
      rejectClose: false,
      window: { title: game.i18n.format("CYPHER.NPC.RollAttackTitle", { name: attack.name }) },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("CYPHER.NPC.Defense")}</label>
          <select name="defenseType">
            <option value="dodge">${game.i18n.localize("CYPHER.Defense.Dodge")}</option>
            <option value="block">${game.i18n.localize("CYPHER.Defense.Block")}</option>
            <option value="might">${game.i18n.localize("CYPHER.Stat.might")}</option>
            <option value="speed">${game.i18n.localize("CYPHER.Stat.speed")}</option>
            <option value="intellect">${game.i18n.localize("CYPHER.Stat.intellect")}</option>
            ${shieldOptions}
            ${drawnShields}
          </select>
        </div>${cooperationChoices.content}`,
      ok: {
        label: game.i18n.localize("CYPHER.NPC.RollAttack"),
        callback: (event, button) => {
          const choice = button.form.defenseType.value;
          return { defenseType: choice.startsWith("shield:") || choice.startsWith("drawShield:") ? "block" : choice,
            shieldItemId: choice.includes(":") ? choice.split(":")[1] : null,
            cooperativeEffectIds: button.form.cooperativeEffectIds ? [...button.form.cooperativeEffectIds.selectedOptions].map(option => option.value) : null,
            cooperativeMode: choice.startsWith("drawShield:") ? "draw" : button.form.cooperativeMode.value };
        }
      }
    });

    if (!result) return;
    const cooperation = cooperationChoices.resolve(result.cooperativeMode);
    if (!cooperation) return;
    selectedTarget = cooperation.target;
    await this.actor.rollNpcAttack(attack, {
      ...cooperation,
      cooperativeEffectIds: result.cooperativeEffectIds,
      target: selectedTarget,
      physicalAttack: ["block", "dodge"].includes(result.defenseType),
      defenseType: result.defenseType,
      shieldItemId: result.shieldItemId
    });
  }

  /** Prompt for NPC damage, then persist it through the document facade. */
  static async #onApplyDamage(event, target) {
    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Damage")}</label>
        <input type="number" name="amount" value="1" min="0"/>
      </div>
      <div class="form-group inline">
        <label><input type="checkbox" name="ignoreArmor"/> ${game.i18n.localize("CYPHER.NPC.IgnoreArmor")}</label>
      </div>`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CYPHER.NPC.ApplyDamage") },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => ({
          amount: Number(button.form.amount.value),
          ignoreArmor: button.form.ignoreArmor.checked
        })
      }
    });

    if (!result) return;
    await this.actor.applyDamage(result.amount, { ignoreArmor: result.ignoreArmor });
  }
}
