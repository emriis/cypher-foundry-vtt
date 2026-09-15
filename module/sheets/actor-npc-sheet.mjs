const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Foundry sheet for NPC actors.
 *
 * Provides NPC-specific context enrichment and a damage application dialog
 * while delegating common sheet behavior to ActorSheetV2.
 */
export default class CypherNPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** Default application configuration and sheet actions. */
  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "actor", "npc"],
    position: { width: 600, height: 680 },
    window: { resizable: true, title: "CYPHER.Sheet.NPC" },
    actions: {
      applyDamage: CypherNPCSheet.#onApplyDamage
    },
    form: { submitOnChange: true }
  };

  /** Handlebars template parts rendered by the sheet. */
  static PARTS = {
    header: { template: "systems/cypher/templates/actor/npc/header.hbs" },
    body: { template: "systems/cypher/templates/actor/npc/body.hbs", scrollable: [""] }
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

    const enrich = (html) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", { relativeTo: this.actor });
    context.enrichedCombat = await enrich(this.actor.system.combat);
    context.enrichedInteraction = await enrich(this.actor.system.interaction);
    context.enrichedUse = await enrich(this.actor.system.use);
    context.enrichedLoot = await enrich(this.actor.system.loot);
    context.enrichedGmNotes = await enrich(this.actor.system.gmNotes);

    return context;
  }

  /**
   * Prompts for NPC damage and applies the selected armor behavior.
   * @param {Event} event Action event supplied by Foundry.
   * @param {HTMLElement} target Action target supplied by Foundry.
   * @returns {Promise<void>}
   */
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
