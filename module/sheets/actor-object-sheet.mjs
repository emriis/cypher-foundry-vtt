import { damageObject, resetObject, objectDisplay } from "../applications/object-service.mjs";
const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/** GM-authored material targets; damage and resets remain explicit document actions. */
export default class CypherObjectSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "actor", "object"], tag: "form",
    position: { width: 600, height: 620 }, window: { resizable: true },
    form: { submitOnChange: true },
    actions: { damageObject: CypherObjectSheet.#damage, resetObject: CypherObjectSheet.#reset }
  };
  static PARTS = { sheet: { root: true, template: "systems/cypher/templates/actor/object.hbs" } };

  async _prepareContext(options) {
    return { ...await super._prepareContext(options), actor: this.actor, system: this.actor.system,
      object: objectDisplay(this.actor), canConfigure: game.user.isGM && this.actor.isOwner };
  }

  static async #damage() {
    const amount = await DialogV2.prompt({ rejectClose: false,
      window: { title: game.i18n.localize("CYPHER.Object.damage") },
      content: `<label>${game.i18n.localize("CYPHER.Object.damage")}<input name="damage" type="number" min="0" step="1" value="0"/></label>`,
      ok: { callback: (_event, button) => Number(button.form.damage.value) } });
    if (amount !== null && amount !== undefined) await damageObject(this.actor, amount);
  }

  static async #reset() {
    const confirmed = await DialogV2.confirm({ rejectClose: false,
      window: { title: game.i18n.localize("CYPHER.Object.reset") },
      content: `<p>${game.i18n.localize("CYPHER.Object.resetConfirm")}</p>` });
    await resetObject(this.actor, { confirmed: confirmed === true });
  }
}
