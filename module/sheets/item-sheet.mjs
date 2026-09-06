const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export default class CypherItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "item"],
    position: { width: 480, height: 520 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static PARTS = {
    header: { template: "systems/cypher/templates/item/parts/header.hbs" },
    body: { template: "systems/cypher/templates/item/parts/body.hbs", scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.config = CONFIG.CYPHER;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item.system.description ?? "", { relativeTo: this.item }
    );
    return context;
  }
}
