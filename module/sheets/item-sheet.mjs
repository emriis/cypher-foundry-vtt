const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Generic item sheet used by all Cypher item types.
 *
 * Supplies item data, shared configuration, and an enriched description to the
 * Handlebars templates while relying on ItemSheetV2 for common application behavior.
 */
export default class CypherItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** Default application configuration for the item sheet. */
  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "item"],
    position: { width: 480, height: 520 },
    window: { resizable: true },
    actions: {
      toggleDescriptorStat: CypherItemSheet.#onToggleDescriptorStat
    },
    form: { submitOnChange: true }
  };

  /** Handlebars template parts rendered by the sheet. */
  static PARTS = {
    header: { template: "systems/cypher/templates/item/parts/header.hbs" },
    body: { template: "systems/cypher/templates/item/parts/body.hbs", scrollable: [""] }
  };

  /**
   * Builds the template context and enriches the item's HTML description.
   * @param {object} options Application context options.
   * @returns {Promise<object>} Template rendering context.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.config = CONFIG.CYPHER;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item.system.description ?? "", { relativeTo: this.item }
    );

    // Dérivé en objet {might, speed, intellect} pour l'affichage en cases à cocher — le champ
    // de données lui-même reste un tableau (statOptions), plus pratique pour la logique
    // d'application (CypherActor#applyDescriptor).
    // Derived into a {might, speed, intellect} object for checkbox display — the underlying
    // data field itself stays an array (statOptions), which is more convenient for the
    // application logic (CypherActor#applyDescriptor).
    if (this.item.type === "descriptor") {
      const options = this.item.system.statOptions ?? [];
      context.statOptionsSet = {
        might: options.includes("might"),
        speed: options.includes("speed"),
        intellect: options.includes("intellect")
      };
    }

    return context;
  }

  /**
   * Adds or removes a stat from this Descriptor's list of offered choices.
   */
  static async #onToggleDescriptorStat(event, target) {
    const stat = target.dataset.stat;
    const current = this.item.system.statOptions ?? [];
    const next = target.checked
      ? [...new Set([...current, stat])]
      : current.filter(s => s !== stat);

    if (next.length === 0) {
      // Toujours garder au moins une statistique sélectionnée ; on annule la décoche.
      // Always keep at least one stat selected; revert the uncheck.
      target.checked = true;
      return;
    }

    await this.item.update({ "system.statOptions": next });
  }
}
