/** Explicit GM hazard input and read-only exposure presentation; services own all persistence. */
import { declareEnvironmentalExposure, resolveEnvironmentalExposure, endEnvironmentalExposure,
  getEnvironmentalExposures, isEnvironmentAuthority } from "../applications/environment-service.mjs";
import { promptRollOptions } from "./dialogs.mjs";
import { getGeneralConditionKinds } from "../applications/general-effect-service.mjs";

const label = key => game.i18n.localize(`CYPHER.Environment.${key}`);
const general = key => game.i18n.localize(`CYPHER.General.${key}`);
const select = (name, values, localize = label) => `<select name="${name}">${values.map(value => `<option value="${value}">${localize(value)}</option>`).join("")}</select>`;
const warn = () => ui.notifications.warn(label("unavailable"));

/** Prepare display values without writing Actor data during sheet preparation. */
export function environmentalDisplay(actor) {
  return getEnvironmentalExposures(actor).filter(entry => !["ended", "completed"].includes(entry.state)).map(entry => ({
    id: entry.id, name: entry.profile.name, sequence: entry.sequence, state: label(entry.state),
    mode: label(entry.profile.mode), interval: entry.profile.intervalSeconds === null ? label("once")
      : game.i18n.format("CYPHER.Environment.intervalValue", { seconds: entry.profile.intervalSeconds }),
    detail: [entry.profile.mode === "defense" ? game.i18n.format("CYPHER.Environment.defenseValue", {
      stat: game.i18n.localize(`CYPHER.Stat.${entry.profile.stat}`), difficulty: entry.profile.difficulty }) : "",
    entry.profile.severity ? `${general(entry.profile.severity)} × ${entry.profile.wounds}` : "",
    entry.profile.poolDamage ? `${game.i18n.localize(`CYPHER.Stat.${entry.profile.poolDamage.stat}`)}: ${entry.profile.poolDamage.amount}` : "",
    ...entry.profile.conditions.map(effect => `${general(effect.kind)} (${effect.steps})`)].filter(Boolean).join("; "),
    protection: entry.profile.protection?.source ? entry.profile.protection.immune ? `${entry.profile.protection.source}: ${label("immune")}`
      : game.i18n.format("CYPHER.Environment.protectionValue", { source: entry.profile.protection.source,
        wounds: entry.profile.protection.woundReduction, pool: entry.profile.protection.poolReduction }) : "",
    ready: entry.state === "ready", manual: ["manual", "processing"].includes(entry.state)
  }));
}

/** Cancelled declarations never create a profile or spend resources. */
export async function promptEnvironment() {
  if (!isEnvironmentAuthority()) { warn(); return; }
  const result = await foundry.applications.api.DialogV2.prompt({ rejectClose: false,
    position: { width: 560, height: 700 }, window: { title: label("declare"), resizable: true }, content: `
      <p>${label("hint")}</p>
      <div class="form-group"><label for="environment-name">${label("name")}</label><input id="environment-name" name="hazardName" required/></div>
      <div class="form-group"><label>${label("mode")}${select("mode", ["immediate", "defense"])}</label></div>
      <div class="form-group"><label>${label("stat")}${select("stat", ["might", "speed", "intellect"], key => game.i18n.localize(`CYPHER.Stat.${key}`))}</label></div>
      <div class="form-group"><label>${game.i18n.localize("CYPHER.Roll.Difficulty")}<input name="difficulty" type="number" min="0" max="15" step="1" value="3" required/></label></div>
      <div class="form-group"><label>${general("wound")}${select("severity", ["none", "minor", "moderate", "major"], general)}</label></div>
      <div class="form-group"><label>${general("wounds")}<input name="wounds" type="number" min="1" step="1" value="1" required/></label></div>
      <div class="form-group"><label>${general("poolDamage")}${select("poolStat", ["might", "speed", "intellect"], key => game.i18n.localize(`CYPHER.Stat.${key}`))}<input name="amount" type="number" min="0" step="1" value="0" required/></label></div>
      <div class="form-group"><label>${general("condition")}${select("condition", ["none", ...getGeneralConditionKinds()], general)}</label></div>
      <div class="form-group"><label>${general("steps")}<input name="steps" type="number" min="1" step="1" value="1" required/></label></div>
      <div class="form-group"><label><input name="noPhysicalMovement" type="checkbox"/>${label("noPhysicalMovement")}</label></div>
      <div class="form-group"><label>${label("interval")}<input name="intervalSeconds" type="number" min="0" step="1" value="0" required/></label></div>
      <fieldset><legend>${label("protection")}</legend><p>${label("protectionHint")}</p>
      <div class="form-group"><label>${label("source")}<input name="protectionSource"/></label></div>
      <div class="form-group"><label>${label("woundReduction")}<input name="woundReduction" type="number" min="0" max="3" step="1" value="0" required/></label></div>
      <div class="form-group"><label>${label("poolReduction")}<input name="poolReduction" type="number" min="0" step="1" value="0" required/></label></div>
      <div class="form-group"><label><input name="immune" type="checkbox"/>${label("immune")}</label></div></fieldset>`,
    ok: { label: label("save"), callback: (_event, button) => {
      const form = button.form.elements, amount = Number(form.amount.value), interval = Number(form.intervalSeconds.value);
      return { name: form.hazardName.value, mode: form.mode.value, stat: form.stat.value, difficulty: Number(form.difficulty.value),
        severity: form.severity.value === "none" ? null : form.severity.value, wounds: Number(form.wounds.value),
        poolDamage: amount === 0 ? null : { stat: form.poolStat.value, amount },
        conditions: form.condition.value === "none" ? [] : [{ kind: form.condition.value, steps: Number(form.steps.value) }],
        intervalSeconds: interval === 0 ? null : interval, noPhysicalMovement: form.noPhysicalMovement.checked,
        protection: { source: form.protectionSource.value, woundReduction: Number(form.woundReduction.value),
          poolReduction: Number(form.poolReduction.value), immune: form.immune.checked } };
    } } });
  if (result && !await declareEnvironmentalExposure(this.actor, result)) warn();
}

/** Read the original button sequence before dialogs so a stale click cannot apply a later occurrence. */
export async function promptEnvironmentExposure(_event, target) {
  if (!isEnvironmentAuthority()) { warn(); return; }
  const id = target.dataset.exposureId, sequence = Number(target.dataset.sequence);
  const entry = getEnvironmentalExposures(this.actor).find(record => record.id === id);
  if (!entry || entry.sequence !== sequence || entry.state !== "ready") { warn(); return; }
  let intervalPassed = false;
  if (sequence > 0 && !(Number.isFinite(game.time?.worldTime) && Number.isFinite(entry.nextAt) && game.time.worldTime >= entry.nextAt)) {
    intervalPassed = await foundry.applications.api.DialogV2.confirm({ rejectClose: false,
      window: { title: label("apply") }, content: `<p>${label("confirmInterval")}</p>` });
    if (!intervalPassed) return;
  }
  const options = entry.profile.mode === "defense" && !entry.profile.protection.immune
    ? await promptRollOptions(this.actor, { stat: entry.profile.stat, difficulty: entry.profile.difficulty, fixedDifficulty: true }) : {};
  if (!options) return;
  try {
    if (!await resolveEnvironmentalExposure(this.actor, id, { ...options, expectedSequence: sequence, intervalPassed })) warn();
  } catch (error) { console.error("Cypher | Environmental exposure requires reconciliation", error); ui.notifications.warn(label("manualHint")); }
}

/** End the selected exposure; its already applied damage remains. */
export async function endEnvironment(_event, target) {
  const entry = getEnvironmentalExposures(this.actor).find(record => record.id === target.dataset.exposureId);
  let reconciled = false;
  if (["manual", "processing"].includes(entry?.state)) {
    reconciled = await foundry.applications.api.DialogV2.confirm({ rejectClose: false,
      window: { title: label("end") }, content: `<p>${label("manualHint")}</p>` });
    if (!reconciled) return;
  }
  if (!await endEnvironmentalExposure(this.actor, target.dataset.exposureId, { reconciled })) warn();
}
