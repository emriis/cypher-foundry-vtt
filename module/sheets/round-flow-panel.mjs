/** GM declarations and round navigation; application services own the saved queue. */
import { getRoundFlow, planCombatRound, waitCombatTurn, resumeCombatTurn } from "../applications/round-flow-service.mjs";
import { roundActionContext, consumeRoundAction } from "../applications/round-action-service.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const panels = new Map();
const label = key => game.i18n.localize(`CYPHER.Round.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));

/** Keep original Combatants in the tracker; this panel displays additional execution slots. */
export class CypherRoundFlowPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "cypher-round-flow"], position: { width: 520, height: "auto" },
    window: { title: "CYPHER.Round.Title", resizable: true },
    actions: {
      plan: CypherRoundFlowPanel.plan, advance: CypherRoundFlowPanel.advance,
      wait: CypherRoundFlowPanel.wait, resume: CypherRoundFlowPanel.resume,
      activity: CypherRoundFlowPanel.activity, complete: CypherRoundFlowPanel.complete
    }
  };
  static PARTS = { content: { template: "systems/cypher/templates/combat/round-flow.hbs" } };

  constructor(combat) { super(); this.combat = combat; }

  async _prepareContext() {
    const flow = getRoundFlow(this.combat);
    return { started: this.combat.started, round: this.combat.round,
      queue: (flow?.queue ?? []).map((step, index) => ({ ...step,
        name: this.combat.combatants.get(step.combatantId)?.name ?? "—",
        phaseLabel: label(step.phase), current: index === flow.cursor })),
      waiting: (flow?.waiting ?? []).map(entry => ({ ...entry,
        name: this.combat.combatants.get(entry.combatantId)?.name ?? "—" })) };
  }

  /** Collect all choices before saving; special timings are explicit GM adjudications. */
  static async plan() {
    const combat = this.combat, flow = getRoundFlow(combat);
    const plans = combat.started ? flow?.nextPlans ?? [] : flow?.plans ?? [];
    const modes = ["normal", "first", "last", "prepare", "wait"];
    const entries = Array.from(combat.combatants.values());
    const result = await DialogV2.prompt({ rejectClose: false, window: { title: label("Plan") },
      content: `<p>${label("DeclarationHint")}</p>${entries.map((entry, index) => {
        const current = plans.find(plan => plan.combatantId === entry.id);
        return `<div class="form-group"><label for="round-mode-${escape(entry.id)}">${escape(entry.name)}</label><select id="round-mode-${escape(entry.id)}" name="mode${index}" data-combatant-id="${escape(entry.id)}">${modes.map(mode =>
          `<option value="${mode}" ${mode === (current?.mode ?? "normal") ? "selected" : ""}>${label(mode)}</option>`).join("")}</select></div>`;
      }).join("")}`,
      ok: { label: label("Confirm"), callback: (_event, button) => entries.map((entry, index) => ({
        combatantId: entry.id, mode: button.form.elements.namedItem(`mode${index}`).value, confirmed: true
      })) } });
    if (result && !await planCombatRound(combat, result)) ui.notifications.warn(label("Unavailable"));
  }

  static async advance() {
    if (this.combat.started) await this.combat.nextTurn();
    else await this.combat.startCombat();
  }

  static async wait() {
    const trigger = await DialogV2.prompt({ rejectClose: false, window: { title: label("Wait") },
      content: `<div class="form-group"><label>${label("Trigger")}<input name="trigger" type="text"/></label></div>`,
      ok: { callback: (_event, button) => button.form.trigger.value } });
    if (typeof trigger === "string" && !await waitCombatTurn(this.combat, { trigger })) ui.notifications.warn(label("Unavailable"));
  }

  static async resume(_event, target) {
    const entry = getRoundFlow(this.combat)?.waiting.find(entry => entry.combatantId === target.dataset.combatantId);
    if (!entry) return;
    const confirmed = await DialogV2.confirm({ rejectClose: false, window: { title: label("Resume") },
      content: `<p>${label("TriggerHint")}</p><p>${escape(entry.trigger)}</p>` });
    if (confirmed && !await resumeCombatTurn(this.combat, entry.combatantId, { triggerConfirmed: true })) ui.notifications.warn(label("Unavailable"));
  }

  static async activity() {
    const actor = this.combat.combatant?.actor;
    if (!actor || !await consumeRoundAction(roundActionContext(actor, { minorActivity: true }))) ui.notifications.warn(label("Unavailable"));
  }

  /** Record an adjudicated action with no roll, without advancing or granting another action. */
  static async complete() {
    const actor = this.combat.combatant?.actor;
    if (!actor || !await consumeRoundAction(roundActionContext(actor))) ui.notifications.warn(label("Unavailable"));
  }
}

/** Add one accessible entry point without replacing Foundry's version-specific tracker template. */
export function attachRoundControls(tracker, html) {
  const combat = tracker.viewed;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!game.user.isGM || !combat || !root) return;
  const existing = root.querySelector(".cypher-round-button");
  if (existing) { existing.textContent = label("Title"); return; }
  const button = document.createElement("button");
  button.type = "button"; button.className = "cypher-round-button"; button.textContent = label("Title");
  button.addEventListener("click", async () => {
    // Tracker roots can survive partial rerenders and encounter deletion. Resolve
    // the viewed encounter on activation rather than retaining a removed document.
    const current = game.combats.get(tracker.viewed?.id);
    if (!current) return;
    let panel = panels.get(current.id);
    if (!panel?.rendered) { panel = new CypherRoundFlowPanel(current); panels.set(current.id, panel); }
    await panel.render({ force: true });
  });
  root.append(button);
}

/** Refresh only visible panels after committed changes; presentation never writes documents. */
export function refreshRoundPanels() {
  for (const panel of panels.values()) {
    if (panel.rendered) panel.render().catch(error => console.error("Cypher | Round panel refresh failed", error));
  }
}

export function closeRoundPanel(combat) {
  const panel = panels.get(combat.id);
  panels.delete(combat.id);
  if (panel) return panel.close();
}
