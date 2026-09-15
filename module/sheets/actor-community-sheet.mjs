const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Foundry sheet for Community actors.
 *
 * The sheet exposes the actor system data to the Community Handlebars templates
 * and delegates application lifecycle behavior to ActorSheetV2.
 */
export default class CypherCommunitySheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** Default application configuration for the Community sheet. */
  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "actor", "community"],
    position: { width: 600, height: 620 },
    window: { resizable: true, title: "CYPHER.Sheet.Community" },
    form: { submitOnChange: true }
  };

  /** Handlebars template parts rendered by the sheet. */
  static PARTS = {
    header: { template: "systems/cypher/templates/actor/community/header.hbs" },
    body: { template: "systems/cypher/templates/actor/community/body.hbs", scrollable: [""] }
  };

  /**
   * Builds the template context with direct access to the actor and its system data.
   * @param {object} options Application context options.
   * @returns {Promise<object>} Template rendering context.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.actor.system;
    context.actor = this.actor;
    return context;
  }
}
