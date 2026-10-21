/** General-rule controls collect explicit intent; application services own state changes. */
import { getGeneralConditionKinds, getGeneralEffects, nextSourceTurn, setGeneralCondition, setGuarding, removeGeneralEffect } from "../applications/general-effect-service.mjs";
import { declareCooperation } from "../applications/cooperative-service.mjs";
import { rollCooperativeAction, passGuard, resistSpecialDamage, repeatDiseaseExposure } from "../applications/general-action-service.mjs";
import { promptRollOptions, helpChoiceFields } from "./dialogs.mjs";
import { resolveDocumentReference } from "../applications/reference-resolver.mjs";

const label = key => game.i18n.localize(`CYPHER.General.${key}`);
const escape = text => foundry.utils.escapeHTML(text);
const select = (name, values) => `<select name="${name}">${values.map(key => `<option value="${key}">${label(key)}</option>`).join("")}</select>`;

/** Read-only labels for both PC and NPC sheets. */
export function generalEffectDisplay(actor) {
  return getGeneralEffects(actor).map(effect => ({ id: effect.id, label: label(effect.kind),
    detail: effect.taskLabel ?? "", disease: effect.kind === "disease",
    duration: label(effect.kind === "help" ? "oneTask" : effect.until ? "untilNextTurn" : "manualDuration") }));
}

/** Shared sheet action: explicitly toggle a sustained guard. */
export async function toggleGuarding() {
  await setGuarding(this.actor, !getGeneralEffects(this.actor).some(effect => effect.kind === "guarding"));
}

/** Shared sheet action: remove only the selected effect's identity. */
export async function clearGeneralEffect(event, target) {
  const effect = getGeneralEffects(this.actor).find(effect => effect.id === target.dataset.effectId);
  if (effect?.kind === "restrictedDamage" && !await foundry.applications.api.DialogV2.confirm({ rejectClose: false,
    window: { title: label("specialistTreatment") }, content: `<p>${label("confirmTreatment")}</p>` })) return;
  await removeGeneralEffect(this.actor, target.dataset.effectId);
}

/** Daily checks require either advanced game time or the explicit passage-of-day declaration. */
export async function promptDiseaseCheck(event, target) {
  const confirmed = await foundry.applications.api.DialogV2.confirm({ rejectClose: false,
    window: { title: label("disease") }, content: `<p>${label("dayPassed")}</p>` });
  if (!confirmed) return;
  const options = await promptRollOptions(this.actor, { stat: "might" });
  if (options) await repeatDiseaseExposure(this.actor, target.dataset.effectId, { ...options, dayPassedConfirmed: true });
}

/** Shared sheet action: apply an adjudicated condition and its declared interval. */
export async function promptGeneralCondition() {
  const actor = this.actor;
  const result = await foundry.applications.api.DialogV2.prompt({ rejectClose: false,
    window: { title: label("conditions") }, content: `<div class="form-group"><label>${label("condition")}${select("condition", getGeneralConditionKinds())}</label></div>
      <div class="form-group"><label>${label("steps")}<input name="steps" type="number" min="1" step="1" value="1"/></label></div>
      <div class="form-group"><label><input name="nextTurn" type="checkbox" ${nextSourceTurn(actor) ? "checked" : "disabled"}/>${label("untilNextTurn")}</label></div>
      <p>${label("conditionHint")}</p>`,
    ok: { label: label("apply"), callback: (event, button) => ({ kind: button.form.condition.value,
      nextTurn: button.form.nextTurn.checked, steps: Number(button.form.steps.value) }) } });
  if (result) await setGeneralCondition(actor, result.kind, result);
}

/** Target selection preserves actual token Actor identities; no base-Actor substitution. */
function selectedActor() {
  return game.user?.targets?.size === 1 ? [...game.user.targets][0]?.actor : null;
}

/** Declare cooperation or collect the complete task choices before any mutation. */
export async function promptCooperativeAction() {
  const actor = this.actor, target = selectedActor();
  if (!target) { ui.notifications.warn(label("singleTarget")); return; }
  const skills = actor.items.filter(item => item.type === "skill");
  const kinds = target.type === "pc" ? ["help", "complement", "defenseHelp"]
    : ["distraction", "draw", "drawRoll", "guard", "passGuard"];
  const result = await foundry.applications.api.DialogV2.prompt({ rejectClose: false,
    window: { title: label("cooperation") }, content: `<p>${escape(target.name)}</p>
      <div class="form-group"><label>${label("action")}${select("kind", kinds)}</label></div>
      <div class="form-group"><label>${label("taskLabel")}<input name="taskLabel" type="text"/></label></div>
      <div class="form-group"><label>${game.i18n.localize("CYPHER.Roll.LinkedSkill")}<select name="skillItemId"><option value="">${game.i18n.localize("CYPHER.Roll.NoSkill")}</option>
        ${skills.map(item => `<option value="${item.id}">${escape(item.name)}</option>`).join("")}</select></label></div>
      <div class="form-group"><label>${label("stat")}${select("stat", ["might", "speed", "intellect"])}</label></div>
      <p>${label("cooperationHint")}</p>`,
    ok: { label: label("continue"), callback: (event, button) => ({ kind: button.form.kind.value,
      taskLabel: button.form.taskLabel.value, skillItemId: button.form.skillItemId.value || null, stat: button.form.stat.value }) } });
  if (!result) return;
  if (["complement", "drawRoll", "guard", "passGuard"].includes(result.kind)) {
    const stat = result.kind === "drawRoll" ? "intellect" : result.kind === "complement" ? result.stat : "speed";
    const options = await promptRollOptions(actor, { stat, difficulty: target.type === "npc" ? target.system.level : 3 });
    if (!options) return;
    if (result.kind === "passGuard") await passGuard(actor, target, options);
    else await rollCooperativeAction(actor, target, { ...options, ...result,
      kind: result.kind === "drawRoll" ? "draw" : result.kind });
  } else await declareCooperation(actor, target, result);
}

/** Explicit poison/disease/psychic profile; nothing is derived from descriptive text. */
export async function promptSpecialDamage() {
  const result = await foundry.applications.api.DialogV2.prompt({ rejectClose: false,
    window: { title: label("specialDamage") }, content: `
      <div class="form-group"><label>${label("threat")}${select("kind", ["poison", "disease", "psychic"])}</label></div>
      <div class="form-group"><label>${game.i18n.localize("CYPHER.Roll.Difficulty")}<input name="difficulty" type="number" min="0" max="15" value="3"/></label></div>
      <div class="form-group"><label>${label("wound")}${select("severity", ["none", "minor", "moderate", "major"])}</label></div>
      <div class="form-group"><label>${label("wounds")}<input name="wounds" type="number" min="1" step="1" value="1"/></label></div>
      <div class="form-group"><label>${label("poolDamage")}${select("poolStat", ["might", "speed", "intellect"])}<input name="amount" type="number" min="0" step="1" value="0"/></label></div>
      <div class="form-group"><label>${label("condition")}${select("condition", ["none", ...getGeneralConditionKinds().filter(kind => kind !== "prone")])}</label></div>
      <div class="form-group"><label><input name="specialistRequired" type="checkbox"/>${label("specialistTreatment")}</label></div>
      <div class="form-group"><label><input name="ongoing" type="checkbox"/>${label("trackDisease")}</label></div>
      <p>${label("specialDamageHint")}</p>`,
    ok: { label: label("continue"), callback: (event, button) => {
      const form = button.form, amount = Number(form.amount.value);
      return { kind: form.kind.value, difficulty: Number(form.difficulty.value), wounds: Number(form.wounds.value),
        severity: form.severity.value === "none" ? null : form.severity.value,
        poolDamage: amount ? { stat: form.poolStat.value, amount } : null,
        conditions: form.condition.value === "none" ? [] : [{ kind: form.condition.value }],
        specialistRequired: form.specialistRequired.checked, ongoing: form.ongoing.checked };
    } } });
  if (!result) return;
  const options = await promptRollOptions(this.actor, { stat: result.kind === "psychic" ? "intellect" : "might",
    difficulty: result.difficulty, fixedDifficulty: true });
  if (options) await resistSpecialDamage(this.actor, { ...options, ...result });
}

/** Build one-mode choices and resolve actual recipients for the NPC defense dialog. */
export async function incomingCooperationChoices(npc, target) {
  const effects = getGeneralEffects(npc);
  const candidates = [...(game.combat?.combatants?.contents ?? []).map(entry => entry.actor), ...game.actors];
  const actors = new Map(candidates.filter(actor => actor?.type === "pc" && actor !== target && actor.isOwner !== false)
    .map(actor => [actor.uuid, actor]));
  const modes = ["none"];
  if (getGeneralEffects(target).some(effect => ["help", "defenseHelp"].includes(effect.kind))) modes.push("help");
  if (effects.some(effect => effect.kind === "distraction")) modes.push("distraction");
  if (effects.some(effect => effect.kind === "draw" && !effect.cancelled)) modes.push("draw");
  const draw = effects.find(effect => effect.kind === "draw" && !effect.cancelled);
  const drawTarget = draw ? await resolveDocumentReference(draw.sourceUuid, "pc") : null;
  return { drawTarget, content: `<label>${label("cooperation")}<select name="cooperativeMode">
      ${modes.map(key => `<option value="${key}">${label(key)}</option>`).join("")}
      ${[...actors].map(([uuid, actor]) => `<option value="take:${escape(uuid)}">${label("take")} — ${escape(actor.name)}</option>`).join("")}
      </select></label>${helpChoiceFields(target, true)}<p>${label("incomingHint")}</p>`,
    resolve(choice) {
      if (choice.startsWith("take:")) return { cooperativeMode: "take", takeAttackActor: actors.get(choice.slice(5)), target };
      if (choice === "draw") return drawTarget ? { cooperativeMode: "draw", target: drawTarget } : null;
      return { cooperativeMode: choice, target };
    } };
}
