/** Collect confirmed recovery/treatment/contact choices; application services own every write. */
import { CYPHER } from "../config.mjs";
import { getRecoverySources } from "../applications/recovery-service.mjs";
import { getTreatmentProfile } from "../applications/healing-service.mjs";
import { promptRollOptions } from "./dialogs.mjs";

const text = key => game.i18n.localize(key);
const escape = value => foundry.utils.escapeHTML(String(value));

/**
 * Confirm completion and collect source/Last action/wound alternatives before
 * rolling. Optional major-wound Effort is chosen before any recovery mutation.
 * @param {Actor} actor Actual recovering PC.
 * @param {string} interval Recovery interval.
 * @returns {Promise<object|null>} Confirmed service options, or null on dismissal.
 */
export async function promptRecoveryOptions(actor, interval) {
  const sources = getRecoverySources(actor, interval);
  const first = sources.find(source => source.remaining > 0);
  if (!first) return null;
  const machine = sources.some(source => source.requiresPower)
    || (actor.items?.contents ?? Array.from(actor.items ?? [])).some(item => item.system?.key === "machine-not-flesh");
  const options = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, modal: true,
    window: { title: text("CYPHER.Recovery.Title") },
    content: `<div class="form-group"><label>${text("CYPHER.Recovery.SourceLabel")}</label>
      <select name="source" aria-label="${text("CYPHER.Recovery.SourceLabel")}">${sources.map(source => `<option value="${source.id}" ${source.remaining ? "" : "disabled"}
        ${source.id === first.id ? "selected" : ""}>${text(`CYPHER.Recovery.Sources.${source.id}`)} (${source.remaining})</option>`).join("")}</select></div>
      <label><input type="checkbox" name="completed" required/> ${game.i18n.format("CYPHER.Recovery.Completed", { interval: text(`CYPHER.Recovery.${interval}`) })}</label>
      ${interval === "action" ? `<label><input type="checkbox" name="lastAction"/> ${text("CYPHER.Recovery.LastAction")}</label>` : ""}
      ${["hour", "tenHours"].includes(interval) ? `<div class="form-group"><label>${text("CYPHER.Recovery.WoundChoice")}</label>
        <select name="woundChoice" aria-label="${text("CYPHER.Recovery.WoundChoice")}"><option value="moderate">${text(interval === "hour" ? "CYPHER.Recovery.OneModerate" : "CYPHER.Recovery.AllModerate")}</option>
        <option value="minor" ${actor.system.wounds.moderate.current ? "" : "selected"}>${text(interval === "hour" ? "CYPHER.Recovery.AllMinor" : "CYPHER.Recovery.MinorInstead")}</option></select></div>` : ""}
      ${interval === "tenHours" && actor.system.wounds.major.current > 0 ? `<label><input type="checkbox" name="healMajor"/> ${text("CYPHER.Recovery.MajorTask")}</label>` : ""}
      ${machine ? `<label><input type="checkbox" name="machinePowered"/> ${text("CYPHER.Recovery.MachinePowered")}</label>` : ""}`,
    ok: { label: text("CYPHER.Roll.Roll"), callback: (_event, button) => {
      const form = button.form.elements;
      return { source: form.source.value, completed: form.completed.checked, lastAction: form.lastAction?.checked ?? false,
        woundChoice: form.woundChoice?.value, healMajor: form.healMajor?.checked ?? false, machinePowered: form.machinePowered?.checked ?? false };
    } }
  });
  if (!options?.completed) return null;
  if (options.healMajor) {
    options.majorTaskOptions = await promptRollOptions(actor, { difficulty: 6, fixedDifficulty: true });
    if (!options.majorTaskOptions) return null;
  }
  return options;
}

/**
 * Distribute a rolled result without mutating the Actor. The service revalidates
 * total and fresh Pool maxima after this dialog returns.
 * @param {object} context Total, Pool snapshot, permitted stats and editable default.
 * @returns {Promise<object|null>} Points per stat, or null on dismissal.
 */
export async function promptRecoveryAllocation({ total, pools, allowedStats, proposed }) {
  return foundry.applications.api.DialogV2.prompt({ rejectClose: false, modal: true,
    window: { title: text("CYPHER.Recovery.Allocate") },
    content: `<p>${game.i18n.format("CYPHER.Recovery.PointsAvailable", { total })}</p>
      ${CYPHER.stats.map(stat => `<div class="form-group"><label>${text(`CYPHER.Stat.${stat}`)}</label>
      <input type="number" name="${stat}" aria-label="${text(`CYPHER.Stat.${stat}`)}" value="${proposed[stat]}" min="0" step="1"
        max="${Math.min(total, Math.max(0, (pools[stat]?.max ?? 0) - (pools[stat]?.value ?? 0)))}" ${allowedStats.includes(stat) && pools[stat] ? "" : "disabled"}/></div>`).join("")}
      <p>${text("CYPHER.Recovery.AllocationHint")}</p>`,
    ok: { label: text("CYPHER.Recovery.Apply"), callback: (_event, button) =>
      Object.fromEntries(CYPHER.stats.map(stat => [stat, Number(button.form.elements[stat].value)])) }
  });
}

/** Keep actual selected token Actors rather than resolving their world templates. */
function targetsFor(actor, includeNPCs) {
  const permitted = target => target.isOwner !== false && (target.type === "pc" || (includeNPCs && target.type === "npc"));
  const targets = new Map([[actor.uuid ?? actor.id, actor]]);
  for (const target of game.actors.filter(permitted)) targets.set(target.uuid, target);
  let selected = actor.uuid ?? actor.id;
  for (const token of game.user.targets ?? []) {
    if (!token.actor || !permitted(token.actor)) continue;
    targets.set(token.document.uuid, token.actor);
    selected = token.document.uuid;
  }
  return { targets, selected };
}

/** Collect a treatment target and the source-backed time profile, then task choices. */
export async function promptTreatment(actor, severity) {
  const { targets, selected } = targetsFor(actor, false);
  const defaultProfile = actor.system.genre === "superhero" ? "heroic"
    : ["realWorld", "sciFi"].includes(actor.system.genre) ? "realistic" : "standard";
  const choice = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, modal: true,
    window: { title: text("CYPHER.Healing.Treatment") },
    content: `<div class="form-group"><label>${text("CYPHER.Roll.Target")}</label><select name="target" aria-label="${text("CYPHER.Roll.Target")}">
      ${[...targets].map(([id, target]) => `<option value="${escape(id)}" ${id === selected ? "selected" : ""}>${escape(target.name)}</option>`).join("")}</select></div>
      <div class="form-group"><label>${text("CYPHER.Healing.TimeProfile")}</label><select name="timeProfile" aria-label="${text("CYPHER.Healing.TimeProfile")}">
      ${["standard", "realistic", "heroic"].map(profile => `<option value="${profile}" ${defaultProfile === profile ? "selected" : ""}>${text(`CYPHER.Healing.Profiles.${profile}`)}</option>`).join("")}</select></div>
      <p>${text(`CYPHER.Healing.Times.${severity}`)}</p>
      <label><input type="checkbox" name="completed" required/> ${text("CYPHER.Healing.Completed")}</label>`,
    ok: { label: text("CYPHER.Roll.Roll"), callback: (_event, button) => ({ target: targets.get(button.form.elements.target.value),
      timeProfile: button.form.elements.timeProfile.value, completed: button.form.elements.completed.checked, severity }) }
  });
  if (!choice?.completed) return null;
  // The service fixes difficulty/stat from the selected source profile. This
  // dialog contributes only skill, Effort and assets selected by the player/MJ.
  const profile = getTreatmentProfile(choice.target, severity, choice.timeProfile);
  choice.rollOptions = await promptRollOptions(actor, { difficulty: profile.difficulty, fixedDifficulty: true });
  return choice.rollOptions ? choice : null;
}

/** Confirm a valid touched target for the Healing Hand contract before any cost. */
export async function promptHealingHand(actor) {
  const { targets, selected } = targetsFor(actor, true);
  return foundry.applications.api.DialogV2.prompt({ rejectClose: false, modal: true,
    window: { title: text("CYPHER.Healing.Hand") },
    content: `<div class="form-group"><label>${text("CYPHER.Roll.Target")}</label><select name="target" aria-label="${text("CYPHER.Roll.Target")}">
      ${[...targets].map(([id, target]) => `<option value="${escape(id)}" ${id === selected ? "selected" : ""}>${escape(target.name)}</option>`).join("")}</select></div>
      <div class="form-group"><label>${text("CYPHER.Healing.Wound")}</label><select name="severity" aria-label="${text("CYPHER.Healing.Wound")}">
      ${["minor", "moderate", "major"].map(severity => `<option value="${severity}">${text(`CYPHER.Wound.${severity}`)}</option>`).join("")}</select></div>
      <p>${text("CYPHER.Healing.NPCHealth")}</p>
      <label><input type="checkbox" name="touchConfirmed" required/> ${text("CYPHER.Healing.TouchConfirmed")}</label>`,
    ok: { label: text("CYPHER.Healing.Apply"), callback: (_event, button) => ({ target: targets.get(button.form.elements.target.value),
      severity: button.form.elements.severity.value, touchConfirmed: button.form.elements.touchConfirmed.checked }) }
  });
}
