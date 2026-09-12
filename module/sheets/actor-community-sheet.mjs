const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export default class CypherCommunitySheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "actor", "community"],
    position: { width: 600, height: 620 },
    window: { resizable: true, title: "CYPHER.Sheet.Community" },
    form: { submitOnChange: true }
  };

  static PARTS = {
    header: { template: "systems/cypher/templates/actor/community/header.hbs" },
    body: { template: "systems/cypher/templates/actor/community/body.hbs", scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.actor.system;
    context.actor = this.actor;
    return context;
  }
}
